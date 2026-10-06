const express = require("express");

const publicSellerController =
    require("../controller/publicSellerController");


const router =
    express.Router();


/*
=========================================================
PUBLIC SELLER ROUTES
=========================================================

BASE:

/api/public/sellers
=========================================================
*/


/*
GET PUBLIC SELLER

/api/public/sellers/:shopSlug
*/

router.get(
    "/:shopSlug",
    publicSellerController.getPublicSeller
);


/*
GET PUBLIC SELLER PRODUCTS

/api/public/sellers/:shopSlug/products
*/

router.get(
    "/:shopSlug/products",
    publicSellerController.getPublicSellerProducts
);


module.exports =
    router;