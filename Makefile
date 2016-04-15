KII_VERSION=v2.4.3
SOURCE=html5-cloud-sdk-$(KII_VERSION).js
DEST_DIR=typings/kii-cloud-sdk
DEST_WITHOUT_VERSION=$(DEST_DIR)/kii-cloud-sdk.d.ts
DEST_WITH_VERSION=$(DEST_DIR)/kii-cloud-sdk-$(KII_VERSION).d.ts
TERN_DEFS_DIR=libs/tern/defs
TERN_DEFS_WITHOUT_VERSION=$(TERN_DEFS_DIR)/kii-cloud-sdk.json
TERN_DEFS_WITH_VERSION=$(TERN_DEFS_DIR)/kii-cloud-sdk-$(KII_VERSION).json

all: $(DEST_WITHOUT_VERSION) $(TERN_DEFS_DIR)/kii-cloud-sdk.json

$(TERN_DEFS_WITHOUT_VERSION): $(DEST_DIR)/kii-cloud-sdk-$(KII_VERSION).json
	mkdir -p $(TERN_DEFS_DIR)
	mv $(DEST_DIR)/kii-cloud-sdk-$(KII_VERSION).json $(TERN_DEFS_WITH_VERSION)
	ln -s -f -r $(TERN_DEFS_WITH_VERSION) $(TERN_DEFS_WITHOUT_VERSION)

$(DEST_WITHOUT_VERSION): $(DEST_WITH_VERSION)
	ln -s -f -r "$(DEST_WITH_VERSION)" "$(DEST_WITHOUT_VERSION)"

$(DEST_WITH_VERSION): jsdoc

$(DEST_DIR)/kii-cloud-sdk-$(KII_VERSION).json: jsdoc

preprocessed-$(KII_VERSION).js: $(SOURCE) preprocess.sh
	bash preprocess.sh $(SOURCE)
	mv preprocessed.js preprocessed-$(KII_VERSION).js

.PHONY: clean jsdoc

jsdoc: preprocessed-$(KII_VERSION).js typescript_template/publish.js
	KII_VERSION=$(KII_VERSION) jsdoc2 -t=typescript_template -d=$(DEST_DIR) preprocessed-$(KII_VERSION).js

clean:
	rm -f preprocessed-$(KII_VERSION).js
	rm -f $(DEST_WITHOUT_VERSION)
	rm -f $(DEST_WITH_VERSION)
	rm -f $(TERN_DEFS_WITH_VERSION)
	rm -f $(TERN_DEFS_WITHOUT_VERSION)
