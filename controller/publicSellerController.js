const sellerService = require("../service/sellerService");

/*
GET PUBLIC SELLER

GET /api/public/sellers/

Example:
GET /api/public/sellers/biashnet-official

*/

async function getPublicSeller(req, res) {
try {
const shopSlug = req.params.shopSlug;

    if (!shopSlug) {
        return res.status(400).json({
            success: false,
            message: "Shop slug is required.",
        });
    }

    // Pass the slug directly. The service resolves it.
    const seller = await sellerService.getPublicSeller(
        shopSlug
    );

    return res.status(200).json({
        success: true,
        seller,
        shopSlug,
    });
} catch (error) {
    console.error("Public seller error:", {
        shopSlug: req.params.shopSlug || null,
        message: error.message || String(error),
        statusCode: error.statusCode || null,
        code: error.code || null,
    });

    return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Unable to load seller.",
    });
}

}

/*
GET PUBLIC SELLER PRODUCTS

GET /api/public/sellers//products?page=1&limit=20

*/

async function getPublicSellerProducts(req, res) {
try {
const shopSlug = req.params.shopSlug;

    if (!shopSlug) {
        return res.status(400).json({
            success: false,
            message: "Shop slug is required.",
        });
    }

    // Pass the slug directly. Do not resolve it here.
    const result =
        await sellerService.getPublicSellerProducts(
            shopSlug,
            {
                page: req.query.page,
                limit: req.query.limit,
            }
        );

    return res.status(200).json({
        success: true,
        shopSlug,
        ...result,
    });
} catch (error) {
    console.error("Public seller products error:", {
        shopSlug: req.params.shopSlug || null,
        message: error.message || String(error),
        statusCode: error.statusCode || null,
        code: error.code || null,
    });

    return res.status(error.statusCode || 500).json({
        success: false,
        message:
            error.message ||
            "Unable to load seller products.",
    });
}

}

/*
EXPORT

*/

module.exports = {
getPublicSeller,
getPublicSellerProducts,
};