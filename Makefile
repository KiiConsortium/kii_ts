KII_VERSION=v2.3.0
SOURCE=html5-cloud-sdk-$(KII_VERSION).js

all: typings/kii-cloud-sdk/kii-cloud-sdk.d.ts libs/tern/defs/kii-cloud-sdk.json

libs/tern/defs/kii-cloud-sdk.json: typings/kii-cloud-sdk/kii-cloud-sdk.d.ts
	mkdir -p libs/tern/defs/
	mv typings/kii-cloud-sdk/kii-cloud-sdk.json libs/tern/defs/kii-cloud-sdk.json

typings/kii-cloud-sdk/kii-cloud-sdk.d.ts: preprocessed.js typescript_template/publish.js
	KII_VERSION=$(KII_VERSION) jsdoc2 -t=typescript_template -d=typings/kii-cloud-sdk preprocessed.js

preprocessed.js: $(SOURCE) preprocess.sh
	bash preprocess.sh $(SOURCE)

.PHONY: clean

clean:
	rm preprocessed.js
	rm typings/kii-cloud-sdk/kii-cloud-sdk.d.ts
	rm libs/tern/defs/kii-cloud-sdk.json
