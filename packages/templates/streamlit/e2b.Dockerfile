# Use Python 3.10 as the base image
FROM python:3.10

# Ensure the /home/user/project directory exists
RUN mkdir -p /home/user/project

# Set the working directory
WORKDIR /home/user/project

# Copy everything from the current directory into /home/user/project
COPY . .

# Create a virtual environment for Python packages
RUN python3 -m venv venv

# Activate the virtual environment and install Streamlit dependencies
RUN ./venv/bin/pip install --no-cache-dir -r requirements.txt