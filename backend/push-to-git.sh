#!/bin/bash

# Git Push Script for Ketoan ERP Backend
# This script helps you push the refactored code to Git

echo "🚀 Starting Git Push Process..."
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Initializing..."
    git init
    echo "✅ Git initialized"
fi

# Check git status
echo "📊 Checking git status..."
git status

echo ""
echo "📝 Files to be committed:"
git diff --cached --name-only
echo ""

# Ask for confirmation
read -p "Do you want to proceed with commit and push? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled by user"
    exit 1
fi

# Get commit message
echo "Enter commit message (or press Enter for default):"
read commit_message

if [ -z "$commit_message" ]; then
    commit_message="refactor: modular architecture with validation, tests, and caching

- Split routes into separate files (9 route files)
- Add Zod validation layer (13 schemas)
- Add unit tests with Jest (15 test cases)
- Implement Redis caching for dashboard
- Add seed data for testing
- Update documentation"
fi

# Add all files
echo ""
echo "📦 Adding files..."
git add .

# Show what will be committed
echo ""
echo "📋 Files staged for commit:"
git diff --cached --name-only | head -20
echo ""

# Commit
echo "💾 Committing changes..."
git commit -m "$commit_message"

if [ $? -ne 0 ]; then
    echo "❌ Commit failed"
    exit 1
fi

echo "✅ Commit successful"

# Ask for remote URL
echo ""
read -p "Do you want to push to remote? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "✅ Done! You can push later with: git push"
    exit 0
fi

# Check if remote exists
if ! git remote | grep -q "origin"; then
    echo "No remote 'origin' found."
    read -p "Enter remote URL (e.g., https://github.com/username/ketoan-erp.git): " remote_url
    
    if [ -n "$remote_url" ]; then
        git remote add origin "$remote_url"
        echo "✅ Remote added"
    else
        echo "❌ No remote URL provided. You can add it later with:"
        echo "   git remote add origin <url>"
        exit 1
    fi
fi

# Get branch name
branch=$(git branch --show-current)
if [ -z "$branch" ]; then
    branch="main"
fi

echo ""
echo "🌐 Pushing to remote..."
echo "   Remote: $(git remote get-url origin)"
echo "   Branch: $branch"
echo ""

# Push
git push -u origin "$branch"

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Push successful!"
    echo "✅ Your code is now on Git"
else
    echo ""
    echo "❌ Push failed. Please check your credentials and try again."
    echo "💡 Tip: You may need to configure Git:"
    echo "   git config user.name 'Your Name'"
    echo "   git config user.email 'your.email@example.com'"
fi