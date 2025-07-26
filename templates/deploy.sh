#!/bin/bash

if [ "$1" ]; then
    cd "$1" && e2b template build
else
    for dir in */; do
        [ -f "$dir/e2b.toml" ] && (cd "$dir" && e2b template build)
    done
fi 