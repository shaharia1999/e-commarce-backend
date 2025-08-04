const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(" Decoded user:", decoded);
  
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).send({ message: 'Invalid or expired token' });
  }
};
module.exports = verifyToken;

