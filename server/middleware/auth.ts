import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SiweMessage } from 'siwe';

export interface AuthRequest extends Request {
  user?: {
    walletAddress: string;
    userId: string;
  };
}

// Verify JWT token
export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    const decoded = jwt.verify(token, secret) as { walletAddress: string; userId: string };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Optional auth - doesn't block if no token, but adds user if present
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET;

      if (secret) {
        const decoded = jwt.verify(token, secret) as { walletAddress: string; userId: string };
        req.user = decoded;
      }
    }
    next();
  } catch (error) {
    // Silently continue without auth
    next();
  }
};

// Verify SIWE (Sign-In with Ethereum) signature
export const verifySIWESignature = async (
  message: string,
  signature: string,
  expectedAddress: string
): Promise<boolean> => {
  try {
    // Parse and verify the SIWE message
    const siweMessage = new SiweMessage(message);
    const result = await siweMessage.verify({ signature });
    
    if (!result.success) {
      console.error('SIWE verification failed:', result.error);
      return false;
    }
    
    // Check that the address matches
    return siweMessage.address.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error('SIWE verification error:', error);
    // Fallback: try simple message verification for non-SIWE formats
    try {
      const { ethers } = await import('ethers');
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (fallbackError) {
      console.error('Fallback verification also failed:', fallbackError);
      return false;
    }
  }
};

// Generate JWT token
export const generateToken = (walletAddress: string, userId: string): string => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }

  return jwt.sign(
    { walletAddress, userId },
    secret,
    { expiresIn: '7d' }
  );
};
