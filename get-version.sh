#!/bin/bash

grep -oP '(?<="version": "\d.\d.\d.)[a-z]*' system.json