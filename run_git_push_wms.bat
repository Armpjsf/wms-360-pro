@echo off
chcp 65001 >nul
title Git Push nextjs-wms

echo =======================================
echo  Starting Git Commit and Push (nextjs-wms)...
echo =======================================
echo.

echo [1/3] Adding files to Git...
git add components/PushNotificationManager.tsx lib/notificationService.ts

echo.
echo [2/3] Committing changes...
git commit -m "fix: handle push notification action tap redirection"

echo.
echo [3/3] Pushing to remote...
git push

echo.
echo =======================================
echo  Git Push Completed!
echo =======================================
pause
