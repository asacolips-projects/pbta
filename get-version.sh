#!/bin/bash

VAL=$(grep -oP '(?<="version": "\d.\d.\d.)[a-z]*' system.json)
echo ${VAL:='master'}