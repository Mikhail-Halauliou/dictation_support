import {ButtonEvent, DeviceType, ImplementationType} from './dictation_device_base';
import {DigtaSonicMicDevice} from './digta_sonicmic_device';
import {ButtonMappingTestCase, checkButtonMapping} from './test_util/check_button_mapping';
import {cleanState} from './test_util/clean_state';
import {FakeHidDevice} from './test_util/fake_hid_device';

const BUTTON_REPORT_ID = 1;
const RELEASED = [0x01, 0, 0, 0, 0, 0, 0, 0];

// Builds a button report as sent by the SonicMic 3 (bytes 5 to 7 vary).
function report(byte5: number, byte6: number, byte7: number): number[] {
  return [0x01, 0, 0, 0, 0, byte5, byte6, byte7];
}

// Slide switch position codes of the SonicMic II and SonicMic II US. Code 0x01
// is Fast Forward on the SonicMic II and Record on the SonicMic II US.
const SWITCH_FORWARD = 0x01;
const SWITCH_RECORD_US = 0x01;
const SWITCH_STOP = 0x02;
const SWITCH_PLAY = 0x03;
const SWITCH_REWIND = 0x04;

// Builds a button report as sent by the SonicMic II and SonicMic II US: 63
// bytes, of which only bytes 5 and 6 (buttons) and byte 7 (slide switch) vary.
function reportII(
    buttons: number, switchPosition: number, moreButtons = 0): number[] {
  return [
    0x01, 0, 0, 0, 0, moreButtons, buttons, switchPosition,
    ...new Array(55).fill(0)
  ];
}

describe('DigtaSonicMicDevice', () => {
  const state = cleanState<{
    buttonEventListener: jasmine.Spy,
    dictationDevice: DigtaSonicMicDevice,
    fakeHidDevice: FakeHidDevice,
  }>();

  beforeEach(() => {
    state.buttonEventListener = jasmine.createSpy('buttonEventListener');
  });

  async function createDictationDevice(productId: number) {
    state.fakeHidDevice = new FakeHidDevice({productId, vendorId: 0x15d8});
    state.dictationDevice = DigtaSonicMicDevice.create(state.fakeHidDevice);
    state.dictationDevice.addButtonEventListener(state.buttonEventListener);
    await state.dictationDevice.init();
  }

  describe('creates the right device type', () => {
    it('DIGTA_SONICMIC_3', async () => {
      await createDictationDevice(/* productId= */ 0x002a);
      expect(state.dictationDevice.getDeviceType())
          .toBe(DeviceType.DIGTA_SONICMIC_3);
      expect(state.dictationDevice.implType)
          .toBe(ImplementationType.DIGTA_SONICMIC);
    });

    it('DIGTA_SONICMIC_II', async () => {
      await createDictationDevice(/* productId= */ 0x0025);
      expect(state.dictationDevice.getDeviceType())
          .toBe(DeviceType.DIGTA_SONICMIC_II);
      expect(state.dictationDevice.implType)
          .toBe(ImplementationType.DIGTA_SONICMIC);
    });

    it('DIGTA_SONICMIC_II_US', async () => {
      await createDictationDevice(/* productId= */ 0x0026);
      expect(state.dictationDevice.getDeviceType())
          .toBe(DeviceType.DIGTA_SONICMIC_II_US);
      expect(state.dictationDevice.implType)
          .toBe(ImplementationType.DIGTA_SONICMIC);
    });

    it('UNKNOWN for an unsupported product id', async () => {
      await createDictationDevice(/* productId= */ 0x9999);
      expect(state.dictationDevice.getDeviceType()).toBe(DeviceType.UNKNOWN);
    });
  });

  it('handles the SonicMic 3 buttons', async () => {
    await createDictationDevice(/* productId= */ 0x002a);

    // Values as captured from a SonicMic 3.
    const testCases: ButtonMappingTestCase[] = [
      {inputReportData: RELEASED, expectedButtonEvents: undefined},
      // New
      {
        inputReportData: report(0x01, 0, 0),
        expectedButtonEvents: ButtonEvent.EOL_PRIO
      },
      // Insert
      {
        inputReportData: report(0x02, 0, 0),
        expectedButtonEvents: ButtonEvent.INS_OVR
      },
      // Record
      {
        inputReportData: report(0, 0x01, 0),
        expectedButtonEvents: ButtonEvent.RECORD
      },
      // Info/Index
      {
        inputReportData: report(0, 0x02, 0),
        expectedButtonEvents: ButtonEvent.INSTR
      },
      // Position Beginning
      {
        inputReportData: report(0, 0x04, 0),
        expectedButtonEvents: ButtonEvent.POSITION_BEGIN
      },
      // F2
      {
        inputReportData: report(0, 0x08, 0),
        expectedButtonEvents: ButtonEvent.F2_B
      },
      // Position End
      {
        inputReportData: report(0, 0x10, 0),
        expectedButtonEvents: ButtonEvent.POSITION_END
      },
      // F3
      {
        inputReportData: report(0, 0x20, 0),
        expectedButtonEvents: ButtonEvent.F3_C
      },
      // F1
      {
        inputReportData: report(0, 0x80, 0),
        expectedButtonEvents: ButtonEvent.F1_A
      },
      // Rewind
      {
        inputReportData: report(0, 0, 0x01),
        expectedButtonEvents: ButtonEvent.REWIND
      },
      // Fast Forward
      {
        inputReportData: report(0, 0, 0x03),
        expectedButtonEvents: ButtonEvent.FORWARD
      },
      // Stop/Play
      {
        inputReportData: report(0, 0, 0x04),
        expectedButtonEvents: ButtonEvent.PLAY
      },
      // Buttons in different bytes are reported together
      {
        inputReportData: report(0x02, 0x01, 0x04),
        expectedButtonEvents:
            ButtonEvent.INS_OVR | ButtonEvent.RECORD | ButtonEvent.PLAY,
      },
      // Unknown transport codes are ignored
      {inputReportData: report(0, 0, 0x02), expectedButtonEvents: undefined},
      {inputReportData: report(0, 0, 0x07), expectedButtonEvents: undefined},
      // Unused bit
      {inputReportData: report(0, 0x40, 0), expectedButtonEvents: undefined},
    ];
    await checkButtonMapping(
        state.fakeHidDevice, state.dictationDevice, state.buttonEventListener,
        testCases, RELEASED, BUTTON_REPORT_ID);
  });

  it('handles the SonicMic II slide switch', async () => {
    await createDictationDevice(/* productId= */ 0x0025);

    // Sequence as captured from a SonicMic II. The switch position is part of
    // every report, so there is no released state.
    const testCases: ButtonMappingTestCase[] = [
      {
        inputReportData: reportII(0, SWITCH_STOP),
        expectedButtonEvents: ButtonEvent.STOP
      },
      {
        inputReportData: reportII(0, SWITCH_PLAY),
        expectedButtonEvents: ButtonEvent.PLAY
      },
      {
        inputReportData: reportII(0, SWITCH_REWIND),
        expectedButtonEvents: ButtonEvent.REWIND
      },
      {
        inputReportData: reportII(0, SWITCH_PLAY),
        expectedButtonEvents: ButtonEvent.PLAY
      },
      // Record while the switch is at Play
      {
        inputReportData: reportII(0x40, SWITCH_PLAY),
        expectedButtonEvents: ButtonEvent.RECORD | ButtonEvent.PLAY
      },
      {
        inputReportData: reportII(0, SWITCH_STOP),
        expectedButtonEvents: ButtonEvent.STOP
      },
      {
        inputReportData: reportII(0, SWITCH_FORWARD),
        expectedButtonEvents: ButtonEvent.FORWARD
      },
      // Unknown position codes are ignored
      {
        inputReportData: reportII(0, 0x05),
        expectedButtonEvents: ButtonEvent.NONE
      },
    ];
    await checkButtonMapping(
        state.fakeHidDevice, state.dictationDevice, state.buttonEventListener,
        testCases, /* resetInputReport= */ undefined, BUTTON_REPORT_ID);
  });

  it('handles the SonicMic II buttons', async () => {
    await createDictationDevice(/* productId= */ 0x0025);

    // As in the capture, the slide switch stays at Stop.
    await state.fakeHidDevice.handleInputReport(
        reportII(0, SWITCH_STOP), BUTTON_REPORT_ID);

    const buttons: Array<[string, number, ButtonEvent]> = [
      ['F1', 0x04, ButtonEvent.F1_A],
      ['F2', 0x08, ButtonEvent.F2_B],
      ['F3', 0x10, ButtonEvent.F3_C],
      ['Index', 0x20, ButtonEvent.INSTR],
      ['Record', 0x40, ButtonEvent.RECORD],
      ['Insert', 0x80, ButtonEvent.INS_OVR],
    ];
    for (const [name, bit, buttonEvent] of buttons) {
      state.buttonEventListener.calls.reset();
      await state.fakeHidDevice.handleInputReport(
          reportII(bit, SWITCH_STOP), BUTTON_REPORT_ID);
      expect(state.buttonEventListener)
          .withContext(`${name} pressed`)
          .toHaveBeenCalledOnceWith(
              state.dictationDevice, buttonEvent | ButtonEvent.STOP);

      state.buttonEventListener.calls.reset();
      await state.fakeHidDevice.handleInputReport(
          reportII(0, SWITCH_STOP), BUTTON_REPORT_ID);
      expect(state.buttonEventListener)
          .withContext(`${name} released`)
          .toHaveBeenCalledOnceWith(state.dictationDevice, ButtonEvent.STOP);
    }
  });

  it('reports a repeated SonicMic II report only once', async () => {
    await createDictationDevice(/* productId= */ 0x0025);

    // The SonicMic II sends F1 to F3 three times per press.
    for (let i = 0; i < 3; ++i) {
      await state.fakeHidDevice.handleInputReport(
          reportII(0x04, SWITCH_STOP), BUTTON_REPORT_ID);
    }
    expect(state.buttonEventListener)
        .toHaveBeenCalledOnceWith(
            state.dictationDevice, ButtonEvent.F1_A | ButtonEvent.STOP);
  });

  it('handles the SonicMic II US slide switch', async () => {
    await createDictationDevice(/* productId= */ 0x0026);

    // Sequence as captured from a SonicMic II US.
    const testCases: ButtonMappingTestCase[] = [
      {
        inputReportData: reportII(0, SWITCH_PLAY),
        expectedButtonEvents: ButtonEvent.PLAY
      },
      {
        inputReportData: reportII(0, SWITCH_REWIND),
        expectedButtonEvents: ButtonEvent.REWIND
      },
      {
        inputReportData: reportII(0, SWITCH_PLAY),
        expectedButtonEvents: ButtonEvent.PLAY
      },
      // Fast Forward button while the switch is at Play
      {
        inputReportData: reportII(0x40, SWITCH_PLAY),
        expectedButtonEvents: ButtonEvent.FORWARD | ButtonEvent.PLAY
      },
      {
        inputReportData: reportII(0, SWITCH_STOP),
        expectedButtonEvents: ButtonEvent.STOP
      },
      {
        inputReportData: reportII(0, SWITCH_RECORD_US),
        expectedButtonEvents: ButtonEvent.RECORD
      },
      {
        inputReportData: reportII(0, SWITCH_STOP),
        expectedButtonEvents: ButtonEvent.STOP
      },
    ];
    await checkButtonMapping(
        state.fakeHidDevice, state.dictationDevice, state.buttonEventListener,
        testCases, /* resetInputReport= */ undefined, BUTTON_REPORT_ID);
  });

  it('handles the SonicMic II US buttons', async () => {
    await createDictationDevice(/* productId= */ 0x0026);

    // As in the capture, the slide switch stays at Stop.
    await state.fakeHidDevice.handleInputReport(
        reportII(0, SWITCH_STOP), BUTTON_REPORT_ID);

    // [name, byte 6 bit, byte 5 bit, expected event]
    const buttons: Array<[string, number, number, ButtonEvent]> = [
      ['F1', 0x04, 0, ButtonEvent.F1_A],
      ['F2', 0, 0x40, ButtonEvent.F2_B],
      ['F3', 0x10, 0, ButtonEvent.F3_C],
      ['Index', 0x20, 0, ButtonEvent.INSTR],
      ['Fast Forward', 0x40, 0, ButtonEvent.FORWARD],
      ['Insert', 0x80, 0, ButtonEvent.INS_OVR],
    ];
    for (const [name, bit, moreBit, buttonEvent] of buttons) {
      state.buttonEventListener.calls.reset();
      await state.fakeHidDevice.handleInputReport(
          reportII(bit, SWITCH_STOP, moreBit), BUTTON_REPORT_ID);
      expect(state.buttonEventListener)
          .withContext(`${name} pressed`)
          .toHaveBeenCalledOnceWith(
              state.dictationDevice, buttonEvent | ButtonEvent.STOP);

      state.buttonEventListener.calls.reset();
      await state.fakeHidDevice.handleInputReport(
          reportII(0, SWITCH_STOP), BUTTON_REPORT_ID);
      expect(state.buttonEventListener)
          .withContext(`${name} released`)
          .toHaveBeenCalledOnceWith(state.dictationDevice, ButtonEvent.STOP);
    }
  });

  it('ignores input reports with other report ids', async () => {
    await createDictationDevice(/* productId= */ 0x002a);

    await state.fakeHidDevice.handleInputReport(
        report(0, 0x01, 0), /* reportId= */ 2);
    expect(state.buttonEventListener).not.toHaveBeenCalled();
  });

  it('ignores input reports that are too short', async () => {
    await createDictationDevice(/* productId= */ 0x002a);

    await state.fakeHidDevice.handleInputReport(
        [0x01, 0, 0, 0, 0, 0x01], BUTTON_REPORT_ID);
    expect(state.buttonEventListener).not.toHaveBeenCalled();
  });
});
