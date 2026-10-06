const sellerService =
    require("../service/sellerService");

const {
    getUidByShopSlug,
} = require("../service/shopSlugService");


/*
=========================================================
GET PUBLIC SELLER
=========================================================

GET:

/api/public/sellers/:shopSlug
=========================================================
*/

async function getPublicSeller(
    req,
    res
) {

    try {

        const shopSlug =
            req.params.shopSlug;


        if (!shopSlug) {

            return res.status(400).json({

                success: false,

                message:
                    "Shop slug is required."

            });

        }


        /*
        =====================================================
        RESOLVE:

        shopSlug
             ↓
        Firebase UID
        =====================================================
        */

        const sellerId =
            await getUidByShopSlug(
                shopSlug
            );


        if (!sellerId) {

            return res.status(404).json({

                success: false,

                message:
                    "Shop not found."

            });

        }


        /*
        =====================================================
        LOAD SELLER USING EXISTING SERVICE
        =====================================================
        */

        const seller =
            await sellerService.getPublicSeller(
                sellerId
            );


        return res.json({

            success: true,

            seller,

            shopSlug,

        });

    } catch (error) {

        console.error(
            "Public seller error:",
            error
        );


        return res.status(
            error.statusCode || 400
        ).json({

            success: false,

            message:
                error.message ||
                "Unable to load seller."

        });

    }

}


/*
=========================================================
GET PUBLIC SELLER PRODUCTS
=========================================================

GET:

/api/public/sellers/:shopSlug/products?page=1&limit=20
=========================================================
*/

async function getPublicSellerProducts(
    req,
    res
) {

    try {

        const shopSlug =
            req.params.shopSlug;


        if (!shopSlug) {

            return res.status(400).json({

                success: false,

                message:
                    "Shop slug is required."

            });

        }


        /*
        =====================================================
        RESOLVE:

        shopSlug
             ↓
        Firebase UID
        =====================================================
        */

        const sellerId =
            await getUidByShopSlug(
                shopSlug
            );


        if (!sellerId) {

            return res.status(404).json({

                success: false,

                message:
                    "Shop not found."

            });

        }


        /*
        =====================================================
        LOAD PRODUCTS USING EXISTING SERVICE
        =====================================================
        */

        const result =
            await sellerService.getPublicSellerProducts(
                sellerId,
                {

                    page:
                        req.query.page,

                    limit:
                        req.query.limit,

                }
            );


        return res.json({

            success: true,

            shopSlug,

            ...result,

        });

    } catch (error) {

        console.error(
            "Public seller products error:",
            error
        );


        return res.status(
            error.statusCode || 400
        ).json({

            success: false,

            message:
                error.message ||
                "Unable to load seller products."

        });

    }

}


module.exports = {

    getPublicSeller,

    getPublicSellerProducts,

};