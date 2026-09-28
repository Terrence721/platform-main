import {
  EntityOp,
  makeErrorOp,
  makeSuccessOp,
  OP_ERROR,
  OP_SUCCESS,
  persistOps,
} from '../../';

describe('EntityOp', () => {
  const ops: string[] = Object.values(EntityOp);
  const isResultOp = (op: string) =>
    op.endsWith(OP_SUCCESS) || op.endsWith(OP_ERROR);

  it('should have a success and an error op for every op the effects persist', () => {
    for (const op of persistOps) {
      expect(ops).toContain(makeSuccessOp(op));
      expect(ops).toContain(makeErrorOp(op));
    }
  });

  it('should have both result ops or neither for every op', () => {
    for (const op of ops.filter((o) => !isResultOp(o))) {
      const hasSuccess = ops.includes(makeSuccessOp(op as EntityOp));
      const hasError = ops.includes(makeErrorOp(op as EntityOp));
      expect({ op, hasError }).toEqual({ op, hasError: hasSuccess });
    }
  });

  it('should have the op each result op was made from', () => {
    for (const op of ops.filter(isResultOp)) {
      expect(ops).toContain(op.replace(/\/(success|error)$/, ''));
    }
  });

  it('should give every op its own value', () => {
    expect(new Set(ops).size).toBe(ops.length);
  });
});
