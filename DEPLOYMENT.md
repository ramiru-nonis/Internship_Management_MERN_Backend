# Deployment Guide - Backend (Railway)

## Prerequisites
- GitHub repository: https://github.com/ramiru-nonis/Internship_Management_MERN_Backend
- Railway account (sign up at https://railway.app)
- MongoDB Atlas account and cluster (https://www.mongodb.com/cloud/atlas)
- Cloudinary account (https://cloudinary.com)

## Deployment Steps

### 1. Set Up MongoDB Atlas
1. Go to https://cloud.mongodb.com
2. Create a new cluster (free tier available)
3. Create a database user with password
4. Whitelist all IP addresses (0.0.0.0/0) for Railway access
5. Get your connection string (replace `<password>` with your actual password)

### 2. Connect to Railway
1. Go to https://railway.app and sign in with GitHub
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `Internship_Management_MERN_Backend` repository

### 3. Configure Environment Variables
In Railway project settings, add the following environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `PORT` | `5001` | Server port (Railway will override if needed) |
| `MONGO_URI` | Your MongoDB Atlas connection string | Database connection |
| `JWT_SECRET` | Strong random string | JWT token secret (generate a secure one) |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name | File upload service |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key | File upload service |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret | File upload service |
| `FRONTEND_URL` | Your Vercel frontend URL | CORS configuration |

**Example MongoDB URI:**
```
mongodb+srv://username:password@cluster.mongodb.net/internship_db?retryWrites=true&w=majority
```

**Generate JWT Secret:**
```bash
# Run this in terminal to generate a secure secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4. Deploy
1. Railway will automatically deploy after you add environment variables
2. Wait for the build to complete
3. Your API will be live at `https://your-app.railway.app`

### 5. Get Railway URL
1. Go to your Railway project
2. Click on "Settings"
3. Find "Domains" section
4. Copy the Railway domain (e.g., `https://your-app.railway.app`)

## Post-Deployment

### Update Frontend
Update your Vercel frontend's `NEXT_PUBLIC_API_URL` environment variable to point to your Railway backend URL:
```
NEXT_PUBLIC_API_URL=https://your-app.railway.app
```

### Test the API
Visit your Railway URL in a browser. You should see:
```
API is running...
```

Test an endpoint:
```
https://your-app.railway.app/api/auth/login
```

## Troubleshooting

### Build Failures
- Check build logs in Railway dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version (>= 18.0.0)

### Database Connection Issues
- Verify MongoDB Atlas connection string is correct
- Check that IP whitelist includes 0.0.0.0/0
- Ensure database user has correct permissions

### CORS Errors
- Verify `FRONTEND_URL` matches your Vercel deployment URL
- Check that CORS is configured in `server.js`

### File Upload Issues
- Verify Cloudinary credentials are correct
- Check Cloudinary dashboard for upload limits

## Local Development
```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Update .env with your local/development values
# MONGO_URI=your_mongodb_connection
# JWT_SECRET=your_secret
# etc.

# Run development server
npm run dev
```

## Redeployment
Railway automatically redeploys when you push to the main branch. For manual deployment:
1. Go to Railway dashboard
2. Select your project
3. Click "Redeploy" on the latest deployment

## Monitoring
- View logs in Railway dashboard
- Monitor database usage in MongoDB Atlas
- Check API performance in Railway metrics
