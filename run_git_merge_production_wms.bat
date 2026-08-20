@echo off
chcp 65001 >nul
title Merge to Production - nextjs-wms

echo ===================================================
echo  Merging changes to Production branch (WMS)...
echo ===================================================
echo.

echo [1/4] Detecting default branch (main or master)...
git rev-parse --verify main >nul 2>&1
if %errorlevel% equ 0 (
    set MAIN_BRANCH=main
) else (
    git rev-parse --verify master >nul 2>&1
    if %errorlevel% equ 0 (
        set MAIN_BRANCH=master
    ) else (
        echo Error: Could not detect main or master branch.
        goto end
    )
)
echo Default branch detected: %MAIN_BRANCH%
echo.

echo [2/4] Switching to %MAIN_BRANCH% and pulling latest...
git checkout %MAIN_BRANCH%
git pull origin %MAIN_BRANCH%
echo.

echo [3/4] Merging current branch changes...
@rem We merge the previous HEAD or the branch we just came from
for /f "tokens=*" %%i in ('git rev-parse --abbrev-ref HEAD') do set PREV_BRANCH=%%i
git merge @{-1} -m "merge: push notification tap redirection fix"
if %errorlevel% neq 0 (
    echo Error: Merge conflict detected. Please resolve conflicts manually.
    goto end
)
echo.

echo [4/4] Pushing to remote to trigger Vercel Production deployment...
git push origin %MAIN_BRANCH%
echo.

echo ===================================================
echo  Merge Completed! Vercel is now deploying WMS to Production.
echo ===================================================

:end
pause
