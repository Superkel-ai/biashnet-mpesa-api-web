const {
    db,
    FieldValue,
} = require("../config/firebase");

const { slugify } = require("../utils/slug");

const SHOP_SLUGS_COLLECTION = "shopSlugs";

/* =========================================================
   CHECK IF SLUG EXISTS
========================================================= */

const slugExists = async (slug) => {
  const ref = db
    .collection(SHOP_SLUGS_COLLECTION)
    .doc(slug);

  const snap = await ref.get();

  return snap.exists;
};

/* =========================================================
   GENERATE UNIQUE SLUG
========================================================= */

const generateUniqueSlug = async (shopName) => {
  const baseSlug = slugify(shopName);

  if (!baseSlug) {
    throw new Error(
      "A valid shop name is required to generate a shop slug."
    );
  }

  let slug = baseSlug;
  let counter = 2;

  while (await slugExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
};

/* =========================================================
   RESERVE SLUG
========================================================= */

const reserveShopSlug = async (slug, uid) => {
  if (!slug || !uid) {
    throw new Error(
      "Slug and UID are required to reserve a shop slug."
    );
  }

  const ref = db
    .collection(SHOP_SLUGS_COLLECTION)
    .doc(slug);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);

    if (snap.exists) {
      const existing = snap.data();

      if (existing.uid !== uid) {
        throw new Error(
          "This shop slug is already in use."
        );
      }

      return;
    }

    transaction.set(ref, {
      uid,
      slug,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    slug,
    uid,
  };
};

/* =========================================================
   CREATE UNIQUE SLUG + RESERVE
========================================================= */

const createShopSlug = async (shopName, uid) => {
  if (!shopName) {
    throw new Error(
      "Shop name is required."
    );
  }

  if (!uid) {
    throw new Error(
      "Seller UID is required."
    );
  }

  const baseSlug = slugify(shopName);

  if (!baseSlug) {
    throw new Error(
      "Shop name cannot generate a valid slug."
    );
  }

  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const ref = db
      .collection(SHOP_SLUGS_COLLECTION)
      .doc(slug);

    try {
      await db.runTransaction(
        async (transaction) => {
          const snap =
            await transaction.get(ref);

          if (snap.exists) {
            const existing =
              snap.data();

            /*
             * Seller already owns this slug.
             */

            if (
              existing.uid === uid
            ) {
              return;
            }

            throw new Error(
              "SLUG_TAKEN"
            );
          }

          transaction.set(ref, {
            uid,
            slug,
            createdAt:
              FieldValue.serverTimestamp(),
          });
        }
      );

      return {
        slug,
        uid,
      };

    } catch (error) {

      /*
       * Only retry when another seller
       * already owns the slug.
       */

      if (
        error.message !==
        "SLUG_TAKEN"
      ) {
        throw error;
      }

      slug =
        `${baseSlug}-${counter}`;

      counter += 1;
    }
  }
};

/* =========================================================
GET SELLER UID FROM SLUG — WITH DIAGNOSTICS
========================================================= */

const getUidByShopSlug = async (shopSlug) => {
console.log("[SHOP_SLUG_LOOKUP]", {
requestedShopSlug: shopSlug || null,
});

if (!shopSlug) {
console.error("[SHOP_SLUG_LOOKUP]", {
reason: "Shop slug is missing or empty.",
});

return null;

}

try {
const ref = db
.collection(SHOP_SLUGS_COLLECTION)
.doc(shopSlug);

const snap = await ref.get();

if (!snap.exists) {
  console.error("[SHOP_SLUG_LOOKUP:DOCUMENT_MISSING]", {
    collection: SHOP_SLUGS_COLLECTION,
    documentId: shopSlug,
    reason: "The shop slug document does not exist.",
  });

  return null;
}

const data = snap.data();
const uid = data?.uid || null;

if (!uid) {
  console.error("[SHOP_SLUG_LOOKUP:UID_MISSING]", {
    collection: SHOP_SLUGS_COLLECTION,
    documentId: shopSlug,
    documentExists: true,
    availableFieldNames: Object.keys(data || {}),
    reason: "The document exists but its uid field is missing or empty.",
  });

  return null;
}

console.log("[SHOP_SLUG_LOOKUP:SUCCESS]", {
  requestedShopSlug: shopSlug,
  resolvedSellerId: uid,
});

return uid;

} catch (error) {
console.error("[SHOP_SLUG_LOOKUP]", {
requestedShopSlug: shopSlug,
collection: SHOP_SLUGS_COLLECTION,
errorName: error.name || null,
errorMessage: error.message || String(error),
errorCode: error.code || null,
});

throw error;

}
};

/* =========================================================
   GET SHOP SLUG BY UID
========================================================= */

const getShopSlugByUid = async (
  uid
) => {
  if (!uid) {
    return null;
  }

  const snapshot = await db
    .collection(SHOP_SLUGS_COLLECTION)
    .where("uid", "==", uid)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data().slug;
};

/* =========================================================
   VALIDATE SLUG OWNERSHIP
========================================================= */

const isSlugOwnedByUid = async (
  slug,
  uid
) => {
  if (!slug || !uid) {
    return false;
  }

  const ref = db
    .collection(SHOP_SLUGS_COLLECTION)
    .doc(slug);

  const snap = await ref.get();

  if (!snap.exists) {
    return false;
  }

  return snap.data().uid === uid;
};

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  slugExists,
  generateUniqueSlug,
  reserveShopSlug,
  createShopSlug,
  getUidByShopSlug,
  getShopSlugByUid,
  isSlugOwnedByUid,
};
