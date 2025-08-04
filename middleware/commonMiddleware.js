const express = require("express");
const cors = require("cors");

const applyCommonMiddleware = (app) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://mongo-db-zeta-seven.vercel.app',
    'https://e-eomarce-edmin-eanel.vercel.app',
    'https://ecommerce-web-1l99.vercel.app/'
  ];

  app.use(express.json());
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like curl or mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }));

  app.use(express.urlencoded({ extended: true }));
};

module.exports = applyCommonMiddleware;
