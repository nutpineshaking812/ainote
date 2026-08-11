import { Sender, SenderProps, Suggestion } from '@ant-design/x';
import { Flex, Input, GetProps, GetRef } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import React, { useRef, useState, forwardRef, useCallback, ChangeEvent, useEffect } from 'react';
import { useBlockNoteEditor, useComponentsContext } from '@blocknote/react';
import { senderRef } from './RefStore';
import { SenderComponent } from '../../sender';

const MyCustomTextArea = forwardRef<
  TextAreaRef, // <--- 修正: 使用 AntD 的 TextAreaRef 类型
  GetProps<typeof Input.TextArea> // 获取 Input.TextArea 的所有 props 类型
>((props, ref) => {
  //   {
  //     "disabled": false,
  //     "className": "ant-sender-input",
  //     "autoSize": {
  //         "minRows": 1,
  //         "maxRows": 6
  //     },
  //     "value": "",
  //     "variant": "borderless",
  //     "placeholder": "向人工智能提问任何问题…"
  // }
  const { onKeyDown, onChange, autoSize, value, className, variant, placeholder, disabled } = props;
  // console.log(props);

  // 你可以在这里添加任何你想要的 textarea 行为或样式
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    // Forward the keyboard event to the wrapped component's onKeyDown
    // Cast to HTMLTextAreaElement to match the expected prop signature
    props.onKeyDown?.(event as React.KeyboardEvent<HTMLTextAreaElement>);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    // The Sender component or surrounding form may expect either the raw event
    // or the value as first argument. The safest approach is to forward the raw
    // event, which mirrors the API of Input.TextArea. The parent Sender's
    // plumbing will normalize it if needed.
    props.onChange?.(event as any);
  };

  const Components = useComponentsContext()!;
  return (
    // <Input.TextArea
    //   ref={ref} // <--- 将 ref 直接传递给 AntD 的 Input.TextArea
    //   {...rest} // 传递所有剩余的 props
    //   onKeyDown={handleKeyDown} // 覆盖或增强 onKeyDown
    //   style={{
    //     ...props.style // 确保原始样式也能被应用
    //   }}
    // />
    <div className={'bn-combobox'}>
      <Components.Generic.Form.Root>
        <Components.Generic.Form.TextInput
          key={'input-' + props.disabled}
          className={className}
          name={'ai-prompt'}
          variant={'large'}
          value={value as string}
          autoFocus={true}
          placeholder={placeholder}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          autoComplete={'off'}
          icon={null}
        />
      </Components.Generic.Form.Root>
    </div>
  );
});

export type CustomSenderProps = {
  className?: string;
  name?: string;
  variant?: 'small' | 'large';
  icon?: React.ReactNode;
  value?: string;
  autoFocus?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void; // onKeyDown 应该兼容 Textarea
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: 'on' | 'off';
  rightSection?: React.ReactNode;
};

const slotConfig: SenderProps['slotConfig'] = [];

export const CustomSender = (props: CustomSenderProps) => {
  // const senderRef = useRef<GetRef<typeof Sender>>(null);
  const editor = useBlockNoteEditor(); // 获取 editor 实例

  const handleCustomSenderKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // 在这里，我们可以将焦点交还给 editor
      if (event.key === 'Enter' && !event.shiftKey) {
        // console.log('CustomSender: Returning focus to editor on Enter.');
        editor.focus();
      }
      // 确保调用从父组件传递下来的 onKeyDown prop
      props.onKeyDown?.(event);
    },
    [editor, props.onKeyDown],
  );

  const handleSenderOnChange = useCallback(
    (
      value: string,
      event?: React.FormEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
      // console.log('CustomSender: onChange value:', value);
      if (!props.onChange) return;
      props.onChange({
        target: {
          value: value,
        },
      } as ChangeEvent<HTMLInputElement>);
    },
    [props.onChange],
  );

  // useEffect(() => {
  //   // 每当 props.value 变化时，更新 slotConfig
  //   if (senderRef.current) {
  //     if (props.value === '') {
  //       senderRef.current?.clear();
  //     } else {
  //       senderRef.current!.insert([{
  //         type: 'text',
  //         value: props.value || ''
  //       }], 'cursor'); // 使用 insert 方法更新内容
  //     }
  //   }
  // }, [props.value]);

  useEffect(() => {
    senderRef.current?.focus();
  }, []);

  return (
    <Flex vertical gap="middle" style={{ backgroundColor: 'white' }} className="custom-sender">
      {/* <Sender
      key={'sender'}
      ref={senderRef} // ref 传递给 Sender 组件
      placeholder={props.placeholder}
      autoSize={{ minRows: 1, maxRows: 6 }}
      value={props.value}
      className={props.className}
      disabled={props.disabled}
      onKeyDown={handleCustomSenderKeyDown} // 将我们增强过的 onKeyDown 传递给 Sender
      onChange={handleSenderOnChange}
      prefix={props.icon}
      suffix={props.rightSection}
      // 关键：在这里使用 components 属性，传入你的自定义 Textarea 组件
      components={{
        input: MyCustomTextArea,
      }}
    /> */}
      <SenderComponent
        ref={senderRef}
        prefix={props.icon}
        suffix={props.rightSection ?? false}
        disabled={props.disabled}
        autoSize={{ minRows: 1, maxRows: 3 }}
        placeholder={props.placeholder}
        onKeyDown={handleCustomSenderKeyDown}
        onChange={handleSenderOnChange}
      />
    </Flex>
  );
};
