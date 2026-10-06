require("dotenv").config();
const {
    db,
    FieldValue,
} = require("../config/firebase");

const {
    COLLECTIONS,
} = require("../config/collections");

const {
    createShopSlug,
    reserveShopSlug,
} = require("../service/shopSlugService");


/*
=========================================================
BIASHNET SHOP SLUG MIGRATION
=========================================================

PURPOSE

Creates permanent shopSlug values for existing sellers.

SELLER SOURCE:

users/{uid}

SELLER CONDITION:

roles.seller === true

SHOP NAME SOURCE:

seller.name

RESULT:

users/{uid}
    ↓
shopSlug

shopSlugs/{shopSlug}
    ↓
uid

IMPORTANT:

- Does NOT change Firebase UID
- Does NOT modify products
- Does NOT modify seller roles
- Does NOT modify seller verification
- Safe to run more than once
- Existing shopSlug values are preserved
=========================================================
*/


async function migrateShopSlugs() {

    console.log("");
    console.log(
        "=============================================="
    );
    console.log(
        " BIASHNET SHOP SLUG MIGRATION"
    );
    console.log(
        "=============================================="
    );
    console.log("");


    let processed = 0;
    let created = 0;
    let alreadyExists = 0;
    let skipped = 0;
    let failed = 0;


    /*
    =====================================================
    LOAD ALL USERS
    =====================================================
    */

    const snapshot =
        await db
            .collection(
                COLLECTIONS.USERS
            )
            .get();


    console.log(
        `Found ${snapshot.size} user accounts.`
    );

    console.log("");


    /*
    =====================================================
    PROCESS USERS
    =====================================================
    */

    for (
        const userDoc
        of snapshot.docs
    ) {

        const seller =
            userDoc.data();


        /*
        =================================================
        ONLY SELLERS
        =================================================
        */

        if (
            seller.roles?.seller !== true
        ) {

            skipped++;

            continue;

        }


        processed++;


        const uid =
            userDoc.id;


        /*
        =================================================
        EXISTING SLUG
        =================================================

        If the seller already has a slug,
        preserve it.

        We also make sure the shopSlugs
        mapping exists.
        =================================================
        */

        if (
            seller.shopSlug
        ) {

            try {

                await reserveShopSlug(
                    seller.shopSlug,
                    uid
                );


                alreadyExists++;

                console.log(
                    `✓ ${seller.name || uid} → ${seller.shopSlug}`
                );

            } catch (error) {

                failed++;

                console.error(
                    `✗ Failed existing slug for ${uid}:`,
                    error.message
                );

            }

            continue;

        }


        /*
        =================================================
        SHOP NAME
        =================================================
        */

        const shopName =
            String(
                seller.name ||
                ""
            ).trim();


        /*
        =================================================
        INVALID SHOP NAME
        =================================================
        */

        if (!shopName) {

            skipped++;

            console.log(
                `⚠ Skipped ${uid}: seller has no name.`
            );

            continue;

        }


        /*
        =================================================
        CREATE UNIQUE SLUG
        =================================================
        */

        try {

            const result =
                await createShopSlug(
                    shopName,
                    uid
                );


            const shopSlug =
                result.slug;


            /*
            =============================================
            WRITE SLUG TO SELLER
            =============================================
            */

            await db
                .collection(
                    COLLECTIONS.USERS
                )
                .doc(
                    uid
                )
                .update({

                    shopSlug,

                    shopSlugVersion: 1,

                    shopSlugGeneratedAt:
                        FieldValue.serverTimestamp(),

                    updatedAt:
                        FieldValue.serverTimestamp(),

                });


            created++;


            console.log(
                `✓ ${shopName} → ${shopSlug}`
            );


        } catch (error) {

            failed++;


            console.error(
                `✗ Failed ${shopName} (${uid}):`,
                error.message
            );

        }

    }


    /*
    =====================================================
    SUMMARY
    =====================================================
    */

    console.log("");

    console.log(
        "=============================================="
    );

    console.log(
        " MIGRATION COMPLETE"
    );

    console.log(
        "=============================================="
    );

    console.log(
        `Seller accounts processed: ${processed}`
    );

    console.log(
        `New slugs created:         ${created}`
    );

    console.log(
        `Existing slugs preserved:  ${alreadyExists}`
    );

    console.log(
        `Skipped:                    ${skipped}`
    );

    console.log(
        `Failed:                     ${failed}`
    );

    console.log(
        "=============================================="
    );

    console.log("");


    /*
    =====================================================
    FAIL PROCESS IF MIGRATION HAD ERRORS
    =====================================================
    */

    if (
        failed > 0
    ) {

        throw new Error(
            `${failed} seller slug migration(s) failed.`
        );

    }

}


/*
=========================================================
RUN
=========================================================
*/

migrateShopSlugs()
    .then(() => {

        console.log(
            "✓ BIASHNET shop slug migration finished successfully."
        );

        process.exit(0);

    })
    .catch((error) => {

        console.error("");
        console.error(
            "✗ SHOP SLUG MIGRATION FAILED"
        );
        console.error(
            error
        );

        process.exit(1);

    });
