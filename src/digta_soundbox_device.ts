/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {ButtonEvent, DeviceType, DictationDeviceBase, ImplementationType,} from './dictation_device_base';

const BUTTON_MAPPINGS = new Map<ButtonEvent, number>([
  [ButtonEvent.PLAY, 1 << 0],
  [ButtonEvent.FORWARD, 1 << 1],
  [ButtonEvent.REWIND, 1 << 2],
]);

export class DigtaSoundboxDevice extends DictationDeviceBase {
  readonly implType = ImplementationType.DIGTA_SOUNDBOX;

  static create(hidDevice: HIDDevice) {
    return new DigtaSoundboxDevice(hidDevice);
  }

  getDeviceType(): DeviceType {
    if (this.hidDevice.vendorId === 0x15d8 &&
        this.hidDevice.productId === 0x0004) {
      return DeviceType.DIGTA_SOUNDBOX_830;
    }
    return DeviceType.UNKNOWN;
  }

  protected getButtonMappings(): Map<ButtonEvent, number> {
    return BUTTON_MAPPINGS;
  }

  // The buttons are wired to a CM108AH audio controller, which reports them
  // active low and with the fourth bit shifted down onto the third.
  protected getInputBitmask(data: DataView): number {
    if (data.byteLength < 2) return 0;

    const code = data.getUint8(1);
    return ~((code & 0x07) | ((code & 0x08) >> 2)) & 0x07;
  }

  protected getThisAsDictationDevice(): DigtaSoundboxDevice {
    return this;
  }
}
