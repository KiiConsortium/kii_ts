# TypeScript type definitions for Kii Cloud SDK

This project generates TypeScript type definitions for Kii Cloud SDK from
JsDoc of the SDK.

## Prerequisite

- JsDoc Toolkit (jsdoc2)
- Make
- Bash
- sed

## Usage

1. Download the SDK (html5-cloud-sdk-v2.2.2.js) from Kii and place it in
   the root directory.
2. make

## How it is generated

html5-cloud-sdk-v2.2.2.js
-[preprocess.sh (minor tweak with sed)]→ preprocessed.js
-[jsdoc with custom template]→ JsDoc Symbol objects

## Custom template

The custom template (typescript_template/publish.js) rewrites JsDoc Symbol
objects with rather ad-hoc logics and generates a .d.ts file.
