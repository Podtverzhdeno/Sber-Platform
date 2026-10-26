import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { avatarInitials, DialogAvatar } from "./dialog-avatar";

describe("Messenger identity avatars", () => {
  it("renders the same community identity regardless of placement", () => {
    const { container, rerender } = render(
      <DialogAvatar title="Грантовый конкурс" kind="community" />,
    );
    expect(container.querySelector(".msg-reference-avatar--trophy svg")).toBeTruthy();
    rerender(<DialogAvatar title="Грантовый конкурс" kind="community" className="msg-chat__avatar" />);
    expect(container.querySelector(".msg-chat__avatar.msg-reference-avatar--trophy svg")).toBeTruthy();
  });

  it("preserves the named Mayaki identity across header and sidebar", () => {
    const { container } = render(<DialogAvatar title="Маяки" kind="community" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src", "/messages-reference/mayaki-avatar.svg",
    );
  });

  it("renders unverified contacts as distinct, legible monograms, not as someone else's portrait", () => {
    const { container } = render(<DialogAvatar title="Мария Северова" kind="personal" />);
    expect(avatarInitials("Мария Северова")).toBe("МС");
    expect(container.querySelector(".msg-avatar__initials")).toHaveTextContent("МС");
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("uses an existing reference portrait only for its exact, approved name", () => {
    const { container } = render(<DialogAvatar title="Анна Ковалёва" kind="personal" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src", "/messages-reference/anna-avatar.svg",
    );
  });
});
