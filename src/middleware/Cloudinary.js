import cloudinary from 'cloudinary';
import multer from 'multer';
import multerStorageCloudinary from 'multer-storage-cloudinary';
import "dotenv/config";

const CloudinaryStorage = multerStorageCloudinary.CloudinaryStorage || multerStorageCloudinary;

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const profile = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "profile",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const product = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const deliveryProof = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "delivery-proof",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

export const uploadprofile = multer({ storage: profile });
export const uploadProduct = multer({ storage: product });
export const uploadDeliveryProof = multer({ storage: deliveryProof });