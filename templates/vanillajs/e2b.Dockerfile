# Use Node.js as the base image
FROM node:20

# Ensure the /home/user/project directory exists
RUN mkdir -p /home/user/project

# Copy everything from the current directory into /home/user/project
COPY . /home/user/project

# Run npm install in the project directory
RUN npm install --prefix /home/user/project