#!/bin/bash

# NOTE(G3): Ensure that the css is generated
npm install
npm run build

# NOTE(G3): Generate the website
hugo

# NOTE(G3): Ensure all content and generated docs are 
# in source control.
git add content/ docs/
git status
read -p "Enter commit message: " commit
echo "Commit message: $commit"
# git commit -am "$commit"

# read -p "Push to master [y|n]? " push
# case "$push" in
# 	y|Y ) git push origin master;;
#     n|N ) exit;;
# esac
