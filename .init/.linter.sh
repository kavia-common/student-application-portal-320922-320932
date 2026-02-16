#!/bin/bash
cd /home/kavia/workspace/code-generation/student-application-portal-320922-320932/frontend_web
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

