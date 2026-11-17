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

// Buttons are reported in input report 1. Only these data bytes vary:
// - bytes 5 and 6: one bit per button
// - byte 7: one code for the transport button (SonicMic 3) or for the slide
//   switch position (SonicMic II, SonicMic II US)
const BUTTON_REPORT_ID = 1;

// The code in byte 7 is translated to one of these bits, so that the bitwise
// button mappings also work for it.
const REWIND_BIT = 1 << 16;
const FORWARD_BIT = 1 << 17;
const PLAY_BIT = 1 << 18;
const STOP_BIT = 1 << 19;
const RECORD_BIT = 1 << 20;

type SonicMicModel = {
  deviceType: DeviceType,
  transportCodeBits: Map<number, number>,
  buttonMappings: Map<ButtonEvent, number>,
};

const SONICMIC_3: SonicMicModel = {
  deviceType: DeviceType.DIGTA_SONICMIC_3,
  transportCodeBits: new Map<number, number>([
    [0x01, REWIND_BIT], [0x03, FORWARD_BIT],
    [0x04, PLAY_BIT],  // Stop/Play button
  ]),
  buttonMappings: new Map<ButtonEvent, number>([
    [ButtonEvent.RECORD, 1 << 0],
    [ButtonEvent.INSTR, 1 << 1],
    [ButtonEvent.POSITION_BEGIN, 1 << 2],
    [ButtonEvent.F2_B, 1 << 3],
    [ButtonEvent.POSITION_END, 1 << 4],
    [ButtonEvent.F3_C, 1 << 5],
    [ButtonEvent.F1_A, 1 << 7],
    [ButtonEvent.EOL_PRIO, 1 << 8],
    [ButtonEvent.INS_OVR, 1 << 9],
    [ButtonEvent.REWIND, REWIND_BIT],
    [ButtonEvent.FORWARD, FORWARD_BIT],
    [ButtonEvent.PLAY, PLAY_BIT],
  ]),
};

const SONICMIC_II: SonicMicModel = {
  deviceType: DeviceType.DIGTA_SONICMIC_II,
  transportCodeBits: new Map<number, number>([
    [0x01, FORWARD_BIT],
    [0x02, STOP_BIT],
    [0x03, PLAY_BIT],
    [0x04, REWIND_BIT],
  ]),
  buttonMappings: new Map<ButtonEvent, number>([
    [ButtonEvent.F1_A, 1 << 2],
    [ButtonEvent.F2_B, 1 << 3],
    [ButtonEvent.F3_C, 1 << 4],
    [ButtonEvent.INSTR, 1 << 5],
    [ButtonEvent.RECORD, 1 << 6],
    [ButtonEvent.INS_OVR, 1 << 7],
    [ButtonEvent.REWIND, REWIND_BIT],
    [ButtonEvent.FORWARD, FORWARD_BIT],
    [ButtonEvent.PLAY, PLAY_BIT],
    [ButtonEvent.STOP, STOP_BIT],
  ]),
};

// Compared to the SonicMic II, the slide switch has a Record position instead
// of Fast Forward, Fast Forward is a button instead of Record, and F2 is
// reported in byte 5.
const SONICMIC_II_US: SonicMicModel = {
  deviceType: DeviceType.DIGTA_SONICMIC_II_US,
  transportCodeBits: new Map<number, number>([
    [0x01, RECORD_BIT],
    [0x02, STOP_BIT],
    [0x03, PLAY_BIT],
    [0x04, REWIND_BIT],
  ]),
  buttonMappings: new Map<ButtonEvent, number>([
    [ButtonEvent.F1_A, 1 << 2],
    [ButtonEvent.F3_C, 1 << 4],
    [ButtonEvent.INSTR, 1 << 5],
    [ButtonEvent.FORWARD, 1 << 6],
    [ButtonEvent.INS_OVR, 1 << 7],
    [ButtonEvent.F2_B, 1 << 14],
    [ButtonEvent.RECORD, RECORD_BIT],
    [ButtonEvent.REWIND, REWIND_BIT],
    [ButtonEvent.PLAY, PLAY_BIT],
    [ButtonEvent.STOP, STOP_BIT],
  ]),
};

const MODELS_BY_PRODUCT_ID = new Map<number, SonicMicModel>([
  [0x002a, SONICMIC_3],
  [0x0025, SONICMIC_II],
  [0x0026, SONICMIC_II_US],
]);

const NO_BUTTON_MAPPINGS = new Map<ButtonEvent, number>();

export class DigtaSonicMicDevice extends DictationDeviceBase {
  readonly implType = ImplementationType.DIGTA_SONICMIC;

  static create(hidDevice: HIDDevice) {
    return new DigtaSonicMicDevice(hidDevice);
  }

  getDeviceType(): DeviceType {
    return this.getModel()?.deviceType ?? DeviceType.UNKNOWN;
  }

  // Other input reports don't carry button states and are ignored.
  protected override async onInputReport(event: HIDInputReportEvent) {
    if (event.reportId !== BUTTON_REPORT_ID) return;
    await super.onInputReport(event);
  }

  protected getButtonMappings(): Map<ButtonEvent, number> {
    return this.getModel()?.buttonMappings ?? NO_BUTTON_MAPPINGS;
  }

  // Unknown codes in byte 7 are treated as no transport button pressed.
  protected getInputBitmask(data: DataView): number {
    const model = this.getModel();
    if (model === undefined || data.byteLength < 8) return 0;

    const transportBits = model.transportCodeBits.get(data.getUint8(7)) ?? 0;
    return data.getUint8(6) | (data.getUint8(5) << 8) | transportBits;
  }

  protected getThisAsDictationDevice(): DigtaSonicMicDevice {
    return this;
  }

  private getModel(): SonicMicModel|undefined {
    if (this.hidDevice.vendorId !== 0x15d8) return undefined;
    return MODELS_BY_PRODUCT_ID.get(this.hidDevice.productId);
  }
}
