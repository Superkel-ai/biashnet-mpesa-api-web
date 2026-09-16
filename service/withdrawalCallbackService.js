const {
  db,
  FieldValue,
} = require("../config/firebase");

const {
  COLLECTIONS,
} = require("../config/collections");

const {
  PAYOUT_STATUS,
} = require("../config/paymentConstants");

const {
  completeWithdrawal,
  failWithdrawal,
} = require("./withdrawalService");


/*
=========================================================
BIASHNET B2C CALLBACK SERVICE
=========================================================

RESPONSIBILITY

Receives Safaricom B2C callback data and determines:

SUCCESS
    ↓
withdrawalService.completeWithdrawal()

FAILURE
    ↓
withdrawalService.failWithdrawal()

This service does NOT:

- modify wallet balances directly
- initiate B2C
- authenticate sellers
- calculate commission
- settle marketplace orders

=========================================================
*/


/*
=========================================================
FIND THE WITHDRAWAL A CALLBACK BELONGS TO
=========================================================

Safaricom's B2C result carries no reference of ours —
Occasion and Remarks are not echoed back in
ResultParameters. What it does carry is the
ConversationID / OriginatorConversationID from the
response to our request, and markWithdrawalProcessing()
stores both on the withdrawal. So that is what we match
on (the same way financeWithdrawalCallbackService does),
falling back to the copy kept under b2cRequest.
=========================================================
*/

async function findWithdrawalIdByConversation({
  conversationId,
  originatorConversationId,
}) {

  const lookups = [
    ["conversationId", conversationId],
    ["originatorConversationId", originatorConversationId],
    ["b2cRequest.conversationId", conversationId],
    [
      "b2cRequest.originatorConversationId",
      originatorConversationId,
    ],
  ];


  for (const [field, value] of lookups) {

    if (!value) {

      continue;

    }


    const snapshot =
      await db
        .collection(
          COLLECTIONS.WITHDRAWALS
        )
        .where(field, "==", value)
        .limit(1)
        .get();


    if (!snapshot.empty) {

      return snapshot.docs[0].id;

    }

  }


  return null;

}


/*
=========================================================
MAIN B2C CALLBACK
=========================================================
*/

async function processMpesaB2CCallback(body) {

  /*
  =======================================================
  1. VALIDATE CALLBACK
  =======================================================
  */

  const result =
    body?.Result;


  if (!result) {

    return {

      handled: false,

      reason:
        "INVALID_B2C_CALLBACK",

    };

  }


  /*
  =======================================================
  2. READ RESULT FIELDS
  =======================================================
  */

  const resultCode =
    Number(
      result.ResultCode
    );


  const resultDescription =
    result.ResultDesc ||
    "";


  const originatorConversationId =
    result.OriginatorConversationID ||
    null;


  const conversationId =
    result.ConversationID ||
    null;


  /*
  =======================================================
  3. CALLBACK PARAMETERS
  =======================================================

  Safaricom normally sends:

  ResultParameters
       ↓
  ReferenceData / request identifiers

  We search for useful identifiers.
  =======================================================
  */

  const resultParameters =
    result.ResultParameters
      ?.ResultParameter || [];


  const findParameter =
    (names = []) => {

      const found =
        resultParameters.find(
          item =>
            names.includes(
              item.Key
            )
        );

      return found?.Value ??
        null;

    };


  /*
  =======================================================
  4. IDENTIFY WITHDRAWAL
  =======================================================

  IMPORTANT:

  The best architecture is for your B2C request
  TransactionDesc/QueueTime/Reference field to
  carry withdrawalId.

  We also support TransactionID if your B2C
  implementation stores a mapping.

  =======================================================
  */

  const withdrawalId =
    findParameter([
      "WithdrawalId",
      "withdrawalId",
      "AccountReference",
      "BillReferenceNumber",
      "Reference",
      "TransactionDesc",
    ]) ||
    await findWithdrawalIdByConversation({
      conversationId,
      originatorConversationId,
    });


  /*
  =======================================================
  5. PROVIDER TRANSACTION ID
  =======================================================
  */

  const providerTransactionId =
    result.TransactionID ||
    findParameter([
      "TransactionID",
      "transactionId",
    ]);


  /*
  =======================================================
  6. VALIDATE WITHDRAWAL ID
  =======================================================
  */

  if (!withdrawalId) {

    console.error(
      "❌ B2C callback has no withdrawal ID:",
      JSON.stringify(
        body,
        null,
        2
      )
    );


    return {

      handled: false,

      requiresReview: true,

      reason:
        "MISSING_WITHDRAWAL_ID",

    };

  }


  /*
  =======================================================
  7. SUCCESS
  =======================================================
  */

  if (
    resultCode === 0
  ) {

    const callbackResult =
      await completeWithdrawal({

        withdrawalId,

        transactionId:
          providerTransactionId,

        mpesaReceiptNumber:
          findParameter([
            "TransactionID",
          ]) ||
          providerTransactionId,

        providerResponse:
          body,

      });


    return {

      handled: true,

      success: true,

      withdrawalId,

      status:
        PAYOUT_STATUS.COMPLETED,

      conversationId,

      originatorConversationId,

      providerTransactionId,

      result:
        callbackResult,

    };

  }


  /*
  =======================================================
  8. FAILURE
  =======================================================
  */

  const callbackResult =
    await failWithdrawal({

      withdrawalId,

      reason:
        resultDescription ||
        "M-Pesa B2C withdrawal failed.",

      providerResponse:
        body,

    });


  return {

    handled: true,

    success: false,

    withdrawalId,

    status:
      PAYOUT_STATUS.FAILED,

    resultCode,

    resultDescription,

    conversationId,

    originatorConversationId,

    providerTransactionId,

    result:
      callbackResult,

  };

}


/*
=========================================================
B2C QUEUE TIMEOUT
=========================================================

Safaricom calls QueueTimeOutURL when a payout sat in
their queue too long. The payout usually never happens —
but "usually" is not good enough to hand the money back,
because a late result callback could then pay the seller
twice. So the withdrawal is left exactly as it is, held
and PROCESSING, and flagged for a person to check against
Safaricom's portal before releasing or failing it.
=========================================================
*/

async function processMpesaB2CTimeout(body) {

  const result =
    body?.Result ||
    body ||
    {};


  const conversationId =
    result.ConversationID ||
    null;


  const originatorConversationId =
    result.OriginatorConversationID ||
    null;


  const withdrawalId =
    await findWithdrawalIdByConversation({
      conversationId,
      originatorConversationId,
    });


  if (!withdrawalId) {

    console.error(
      "❌ B2C timeout matched no withdrawal:",
      JSON.stringify(
        body,
        null,
        2
      )
    );


    return {

      handled: false,

      requiresReview: true,

      reason:
        "WITHDRAWAL_NOT_FOUND",

    };

  }


  console.error(
    "⏱️ B2C payout timed out in Safaricom's queue. Left held for review:",
    withdrawalId
  );


  await db
    .collection(
      COLLECTIONS.WITHDRAWALS
    )
    .doc(
      withdrawalId
    )
    .update({

      requiresReview: true,

      reviewReason:
        "B2C_QUEUE_TIMEOUT",

      b2cTimeout: {

        conversationId,

        originatorConversationId,

        providerResponse:
          body,

        receivedAt:
          FieldValue.serverTimestamp(),

      },

      updatedAt:
        FieldValue.serverTimestamp(),

    });


  return {

    handled: true,

    requiresReview: true,

    withdrawalId,

    reason:
      "B2C_QUEUE_TIMEOUT",

  };

}


module.exports = {

  processMpesaB2CCallback,

  processMpesaB2CTimeout,

};