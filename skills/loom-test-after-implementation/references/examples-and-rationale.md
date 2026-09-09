# 实现后测试：示例和判断依据

## 好测试示例

```language
test('重试失败操作 3 次', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

特点：清晰名称、测试真实行为、一次验证一件事、通过 public API 验证。

## 实现示例

```language
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
```

实现先于测试完成。测试针对已成型的 public API（`retryOperation`）编写，不驱动其设计。

## 过度工程示例（test-induced design damage）

```language
// 错误：为实现后"好测"而改设计
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number) => void;
  }
): Promise<T> {
  // YAGNI — 业务没有这些需求，只是为了让测试能注入参数
}
```

不要为可测试性而扩展接口。实现按业务需求写，测试针对真实 public API 写。

## Bug 修复示例

Bug：接受空邮件。

**实现：**

```language
function submitForm(data: FormData) {
  if (!data.email?.trim()) {
    return { error: 'Email required' };
  }
  // ...
}
```

**测试（实现后编写）：**

```language
test('拒绝空邮件', async () => {
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});
```

## 为什么重构在测试前

- 测试会锁定它接触到的结构。如果实现凌乱，测试会锁死凌乱。
- 重构后再写测试，测试保护的是干净结构。
- 跳过重构直接写测试 = 用测试给技术债上锁。

## 为什么覆盖率是发现工具

- 覆盖率数字（如 90%）无法说明测试质量。
- 覆盖率的真正价值：找出**哪些行为没被测到**。
- 对每个未测试区域判断：该行为是否有独立可错路径？有则补测；无则记录判断依据。
- 不要为追覆盖率数字而写无意义测试。

更多反模式见 `references/testing-anti-patterns.md` 和 `references/common-pitfalls.md`。
