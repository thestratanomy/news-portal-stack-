FROM node:20-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_GHOST_ADMIN_URL
ARG NEXT_PUBLIC_STREAMLIT_URL
ENV NEXT_PUBLIC_GHOST_ADMIN_URL=$NEXT_PUBLIC_GHOST_ADMIN_URL
ENV NEXT_PUBLIC_STREAMLIT_URL=$NEXT_PUBLIC_STREAMLIT_URL
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
EXPOSE 3000
CMD ["npm", "start"]
