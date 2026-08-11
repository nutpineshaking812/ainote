import { GetRef } from 'antd';
import { createRef } from 'react';
import { SenderComponent } from '../../sender';

export const senderRef = createRef<GetRef<typeof SenderComponent>>();

export const insertSlotContent = (content: string) => {
  if (senderRef.current) {
    senderRef.current.insert(content);
  }
};

export const clearSlotContent = () => {
  if (senderRef.current) {
    senderRef.current.clear();
  }
};
