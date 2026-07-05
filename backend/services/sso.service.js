import axios from 'axios';
import jwt from 'jsonwebtoken';
import redisClient from '../config/redis';

// SSO configuration
const SSO_CONFIG = {
  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    audience: process.env.AUTH0_AUDIENCE
  },
  azure: {
    tenantId: process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET
  }
};

// SSO service
class SSOService {
  constructor() {
    this.providers = {
      auth0: this.handleAuth0.bind(this),
      azure: this.handleAzure.bind(this),
      google: this.handleGoogle.bind(this)
    };
  }

  // Get provider handler
  getProvider(provider) {
    return this.providers[provider] || this.handleAuth0;
  }

  // Auth0 handler
  async handleAuth0(code, redirectUri) {
    try {
      // Exchange code for token
      const tokenResponse = await axios.post(
        `https://${SSO_CONFIG.auth0.domain}/oauth/token`,
        {
          grant_type: 'authorization_code',
          client_id: SSO_CONFIG.auth0.clientId,
          client_secret: SSO_CONFIG.auth0.clientSecret,
          code,
          redirect_uri: redirectUri
        }
      );

      const { access_token, id_token } = tokenResponse.data;

      // Get user info
      const userResponse = await axios.get(
        `https://${SSO_CONFIG.auth0.domain}/userinfo`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      const user = userResponse.data;

      // Create internal JWT
      const internalToken = jwt.sign(
        {
          userId: user.sub,
          email: user.email,
          name: user.name,
          picture: user.picture
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Cache user session
      await redisClient.setex(
        `session:${user.sub}`,
        86400,
        JSON.stringify({ ...user, internalToken })
      );

      return { success: true, token: internalToken, user };
    } catch (error) {
      console.error('Auth0 SSO error:', error);
      return { success: false, error: error.message };
    }
  }

  // Azure AD handler
  async handleAzure(code, redirectUri) {
    try {
      // Exchange code for token
      const tokenResponse = await axios.post(
        `https://login.microsoftonline.com/${SSO_CONFIG.azure.tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: SSO_CONFIG.azure.clientId,
          client_secret: SSO_CONFIG.azure.clientSecret,
          code,
          redirect_uri: redirectUri
        })
      );

      const { access_token } = tokenResponse.data;

      // Get user info
      const userResponse = await axios.get(
        'https://graph.microsoft.com/1.0/me',
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      const user = userResponse.data;

      // Create internal JWT
      const internalToken = jwt.sign(
        {
          userId: user.id,
          email: user.mail || user.userPrincipalName,
          name: user.displayName
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Cache user session
      await redisClient.setex(
        `session:${user.id}`,
        86400,
        JSON.stringify({ ...user, internalToken })
      );

      return { success: true, token: internalToken, user };
    } catch (error) {
      console.error('Azure SSO error:', error);
      return { success: false, error: error.message };
    }
  }

  // Google handler
  async handleGoogle(code, redirectUri) {
    try {
      // Exchange code for token
      const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        }
      );

      const { access_token } = tokenResponse.data;

      // Get user info
      const userResponse = await axios.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      const user = userResponse.data;

      // Create internal JWT
      const internalToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Cache user session
      await redisClient.setex(
        `session:${user.id}`,
        86400,
        JSON.stringify({ ...user, internalToken })
      );

      return { success: true, token: internalToken, user };
    } catch (error) {
      console.error('Google SSO error:', error);
      return { success: false, error: error.message };
    }
  }

  // Validate session
  async validateSession(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check cache
      const cached = await redisClient.get(`session:${decoded.userId}`);
      if (cached) {
        return { valid: true, user: JSON.parse(cached) };
      }

      return { valid: true, user: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Logout
  async logout(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      await redisClient.del(`session:${decoded.userId}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const ssoService = new SSOService();
export default ssoService;