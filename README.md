# TypeScript and Tern type definitions for Kii Cloud SDK

This project generates TypeScript and Tern type definitions for Kii Cloud SDK from JsDoc of the SDK.

## Prerequisite

- JsDoc Toolkit (jsdoc2)
- Make
- Bash
- sed

## Usage

1. Download the SDK (html5-cloud-sdk-v2.2.2.js) from Kii and place it in the root directory.
2. make

## How is it generated

html5-cloud-sdk-v2.2.2.js
↓
(preprocess.sh (minor tweak with sed))
↓
preprocessed.js
↓
(jsdoc with custom template)
↓
kii-cloud-sdk.d.ts, kii-cloud-sdk.json

## Custom template

The custom template (typescript_template/publish.js) rewrites JsDoc Symbol objects with rather ad-hoc logics, then generates a .d.ts file and a tern type definition file.

## How to use type definitions

### TypeScript

Refer the .d.ts file from your source code like this:

```
/// <reference path="typings/kii-cloud-sdk/kii-cloud-sdk.d.ts" />
```

### Tern

Copy `.tern-project` file and libs directory to your source directory and open your .js files with your favorite editor with appropriate plugins.

Editor|Plugin
------|------
Emacs|tern
Brackets|Brackets-Ternific
Atom|atom-ternjs

Notes on Brackets-Ternific: Brackets-Ternific searches type definitions from plugin directory, not from the project directory, so that you have to copy kii-cloud-sdk.json to ~/Library/Application Support/Brackets/extensions/user/ternific/libs/tern/defs/ (for OS X).
