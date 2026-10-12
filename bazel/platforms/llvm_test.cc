#ifndef __clang__
#error "The native toolchain must be LLVM Clang"
#endif

#include <iostream>
#include <string>

int main() {
  const std::string message = "LLVM native compile, link, and runtime OK";
  std::cout << message << '\n';
  return std::cout.good() ? 0 : 1;
}
