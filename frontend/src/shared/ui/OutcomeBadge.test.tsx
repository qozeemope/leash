import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutcomeBadge } from "./OutcomeBadge";

describe("OutcomeBadge", () => {
  it("shows a readable label for each real outcome", () => {
    const { rerender } = render(<OutcomeBadge outcome="approve" />);
    expect(screen.getByText("Approved")).toBeTruthy();
    rerender(<OutcomeBadge outcome="escalate" />);
    expect(screen.getByText("Needs your OK")).toBeTruthy();
    rerender(<OutcomeBadge outcome="block" />);
    expect(screen.getByText("Blocked")).toBeTruthy();
  });

  it("does not crash for events that carry no decision", () => {
    for (const value of ["", null, undefined, "n/a"]) {
      const { unmount } = render(<OutcomeBadge outcome={value} />);
      expect(screen.getByText("No decision needed")).toBeTruthy();
      unmount();
    }
  });
});
