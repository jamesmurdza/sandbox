# e2b template build --name "terminal"

# Use a Debian-based base image
FROM ubuntu:22.04

# Install dependencies and customize sandbox
RUN apt update \
    && apt install -y sudo

# Install xterm
RUN apt update \
    && apt install -y xterm

RUN apt update \
    && apt install -y tmux screen

# Clean up
RUN apt clean \
    && rm -rf /var/lib/apt/lists/*