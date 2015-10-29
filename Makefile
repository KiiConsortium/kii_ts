SOURCE=html5-cloud-sdk-v2.2.2.js

typings/kii/kii.d.ts: preprocessed.js typescript_template/publish.js
	jsdoc2 -t=typescript_template -d=typings/kii preprocessed.js

preprocessed.js: $(SOURCE) preprocess.sh
	bash preprocess.sh $(SOURCE)

.PHONY: clean

clean:
	rm preprocessed.js
	rm typings/kii/kii.d.ts
