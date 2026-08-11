import jwt from 'jsonwebtoken';
import UserRepository from '../repositories/user.repository.js';
import env from '../config/env.js';

export const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      // Verify token
      const decoded = jwt.verify(token, env.JWT_SECRET);
      // Get user from the token (PostgreSQL)
      const user = await UserRepository.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ success: false, error: 'Not authorized, user not found' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ success: false, error: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Not authorized, no token' });
  }
};
