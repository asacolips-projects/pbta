#!/bin/bash

REGEX="beta|alpha"

# If this is a branch, return it.
if [ "${REF_TYPE}" == 'branch' ]; then
  echo $REF
else
  # If this is a tag with "beta" or "alpha", return that part.
  if [[ $REF =~ $REGEX ]]; then
    echo `echo $REF | sed -r "s/.*($REGEX).*/\1/"`
  # Fallback to latest.
  else
    echo 'latest'
  fi
fi
