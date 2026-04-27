# 官方 npm，避免 login/publish 走到 cnpm 等镜像
NPM_REGISTRY ?= https://registry.npmjs.org
NPM := npm

.PHONY: help test pack version-patch version-minor version-major publish
.PHONY: release release-patch release-minor release-major push

help:
	@echo "Vite MPA 插件 — 常用命令"
	@echo ""
	@echo "  make test              跑单元测试 (vitest)"
	@echo "  make pack              打 tarball 到 stdout（检查将发布哪些文件）"
	@echo "  make version-patch     将 package.json 版本 +0.0.1（会提交 git 并打 tag，工作区需干净）"
	@echo "  make version-minor     小版本 +0.1.0"
	@echo "  make version-major     大版本 +1.0.0"
	@echo "  make publish           先 test 再发布到 $(NPM_REGISTRY)（@scope 用 --access public）"
	@echo "  make release-patch     一键：test -> version-patch -> publish"
	@echo "  make release-minor     一键：test -> version-minor -> publish"
	@echo "  make release-major     一键：test -> version-major -> publish"
	@echo "  make push              将当前分支与 tag 推到 origin（发版后执行）"
	@echo ""
	@echo "环境变量: NPM_REGISTRY（默认即官方，勿用镜像发版）"
	@echo "不提交 git 只改版本: npm version patch --no-git-tag-version"

test:
	$(NPM) test

pack:
	$(NPM) pack --dry-run 2>&1

version-patch:
	$(NPM) version patch

version-minor:
	$(NPM) version minor

version-major:
	$(NPM) version major

publish: test
	$(NPM) publish --access public --registry=$(NPM_REGISTRY)

# 发版前确认已 npm login 且 registry 指向官方
release-patch: test
	$(NPM) version patch
	$(NPM) publish --access public --registry=$(NPM_REGISTRY)

release-minor: test
	$(NPM) version minor
	$(NPM) publish --access public --registry=$(NPM_REGISTRY)

release-major: test
	$(NPM) version major
	$(NPM) publish --access public --registry=$(NPM_REGISTRY)

push:
	git push origin HEAD
	git push origin --tags
