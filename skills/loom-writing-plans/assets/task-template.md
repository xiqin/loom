### Task N: <功能点名称>

- **层级**: 从 `.loom/rules/project-structure.md` 中提取的项目分层名称
- **复杂度**: 简单 / 中等 / 复杂
- **依赖**: Task X, Task Y（无则写"无"）
- **涉及文件**:
  - 创建: `path/to/new/file.<ext>`
  - 修改: `path/to/existing/file.<ext>:123-145`
  - 测试: `tests/path/to/test.<ext>`

- [ ] **步骤 1：写失败的测试**

```language
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **步骤 2：运行测试验证失败**

运行测试用例。预期：FAIL，显示缺少目标行为。

- [ ] **步骤 3：写最小实现**

```language
def function(input):
    return expected
```

- [ ] **步骤 4：运行测试验证通过**

运行测试用例。预期：PASS。
