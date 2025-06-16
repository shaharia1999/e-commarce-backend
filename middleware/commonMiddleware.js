const express = require("express");
const cors = require("cors");
const applyCommonMiddleware = (app) => {
  app.use(express.json());
  app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));

  app.use(express.urlencoded({ extended: true }));
};

module.exports = applyCommonMiddleware;
