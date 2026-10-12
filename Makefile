.PHONY: all build clean serve

all: build

build:
	bazel run //:export

serve:
	bazel run //:serve

clean:
	bazel clean
