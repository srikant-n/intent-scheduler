// Tests for common/Field: label wrapper, hint, and Input/Select/Textarea controls.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Field, Input, Select, Textarea } from './Field';

describe('Field', () => {
  it('renders the label text and children', () => {
    render(
      <Field label="Task title">
        <Input placeholder="Enter title" />
      </Field>,
    );

    expect(screen.getByText('Task title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter title')).toBeInTheDocument();
  });

  it('renders the hint when provided', () => {
    render(
      <Field label="Notes" hint="Optional extra context">
        <Textarea />
      </Field>,
    );

    expect(screen.getByText('Optional extra context')).toBeInTheDocument();
  });

  it('omits the hint element when not provided', () => {
    const { container } = render(
      <Field label="Solo">
        <Input />
      </Field>,
    );
    // Only the label span should exist — no hint span.
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });
});

describe('Input', () => {
  it('accepts typing and merges className', async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Name" className="extra-class" defaultValue="" />);

    const input = screen.getByLabelText('Name');
    await user.type(input, 'hello');
    expect(input).toHaveValue('hello');
    expect(input).toHaveClass('extra-class');
  });
});

describe('Select', () => {
  it('renders options and reflects selection', async () => {
    const user = userEvent.setup();
    render(
      <Select aria-label="Pick" defaultValue="a">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>,
    );

    const select = screen.getByLabelText('Pick');
    expect(select).toHaveValue('a');
    await user.selectOptions(select, 'b');
    expect(select).toHaveValue('b');
  });
});

describe('Textarea', () => {
  it('accepts multi-line input', async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Body" />);

    const area = screen.getByLabelText('Body');
    await user.type(area, 'line one{enter}line two');
    expect(area).toHaveValue('line one\nline two');
  });
});
