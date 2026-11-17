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
  [ButtonEvent.FORWARD, 1 << 0],
  [ButtonEvent.PLAY, 1 << 1],
  [ButtonEvent.REWIND, 1 << 2],
]);

export class DigtaFootControlDevice extends DictationDeviceBase {
  readonly implType = ImplementationType.DIGTA_FOOT_CONTROL;

  protected lastReportId = 0;

  static create(hidDevice: HIDDevice) {
    return new DigtaFootControlDevice(hidDevice);
  }

  getDeviceType(): DeviceType {
    if (this.hidDevice.vendorId === 0x15d8) {
      if (this.hidDevice.productId === 0x0024) {
        return DeviceType.DIGTA_FOOT_CONTROL_540;
      } else if (this.hidDevice.productId === 0x0018) {
        return DeviceType.DIGTA_FOOT_PEDAL_538;
      }
      return DeviceType.UNKNOWN;
    }
    return DeviceType.UNKNOWN;
  }

  protected override async onInputReport(event: HIDInputReportEvent) {
    this.lastReportId = event.reportId ?? 0;
    await super.onInputReport(event);
  }

  protected getButtonMappings(): Map<ButtonEvent, number> {
    return BUTTON_MAPPINGS;
  }

  // Depending on the firmware, the device reports the button state either as
  // the report id, or in the second byte, or in the first byte of the report.
  protected getInputBitmask(data: DataView): number {
    if (this.lastReportId !== 0) return this.lastReportId;
    if (data.byteLength > 1 && data.getUint8(1) !== 0) return data.getUint8(1);
    return data.byteLength > 0 ? data.getUint8(0) : 0;
  }

  protected getThisAsDictationDevice(): DigtaFootControlDevice {
    return this;
  }
}
