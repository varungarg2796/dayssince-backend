FROM node:18-slim
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --loglevel verbose

COPY . . 
# Copies your modified tsconfig.json with rootDir

RUN npx prisma generate

RUN echo ">>> Running 'npm run build' with 'rootDir: ./src' in tsconfig.json..." && \
    npm run build || (echo "ERROR: 'npm run build' FAILED." && exit 1)
RUN echo ">>> Build finished."

RUN echo ">>> Listing of /app/dist AFTER build:" && \
    ls -la /app/dist # Let's see the direct contents of dist

# --- VERIFICATION STEP ---
RUN echo "Verifying build output..." && \
    if [ -f /app/dist/main.js ]; then \
        echo "SUCCESS: /app/dist/main.js found!"; \
    else \
        echo "ERROR: /app/dist/main.js NOT FOUND."; \
        echo "Dumping /app/dist directory structure (if it exists):"; \
        ls -R /app/dist || echo "INFO: /app/dist does not exist or ls -R failed"; \
        echo "Dumping full /app directory structure:"; \
        ls -R /app; \
        exit 1; \
    fi
# --- END VERIFICATION STEP ---

EXPOSE 3000
CMD ["npm", "run", "start:prod"]