import {ButtonEvent, DeviceType, ImplementationType} from './dictation_device_base';
import {DigtaSoundboxDevice} from './digta_soundbox_device';
import {ButtonMappingTestCase, checkButtonMapping} from './test_util/check_button_mapping';
import {cleanState} from './test_util/clean_state';
import {FakeHidDevice} from './test_util/fake_hid_device';

describe('DigtaSoundboxDevice', () => {
  const state = cleanState<{
    buttonEventListener: jasmine.Spy,
    dictationDevice: DigtaSoundboxDevice,
    fakeHidDevice: FakeHidDevice,
  }>();

  beforeEach(() => {
    state.buttonEventListener = jasmine.createSpy('buttonEventListener');
  });

  async function createDictationDevice(productId: number) {
    state.fakeHidDevice = new FakeHidDevice({productId, vendorId: 0x15d8});
    state.dictationDevice = DigtaSoundboxDevice.create(state.fakeHidDevice);
    state.dictationDevice.addButtonEventListener(state.buttonEventListener);
    await state.dictationDevice.init();
  }

  describe('creates the right device type', () => {
    it('DIGTA_SOUNDBOX_830', async () => {
      await createDictationDevice(/* productId= */ 0x0004);
      expect(state.dictationDevice.getDeviceType())
          .toBe(DeviceType.DIGTA_SOUNDBOX_830);
      expect(state.dictationDevice.implType)
          .toBe(ImplementationType.DIGTA_SOUNDBOX);
    });

    it('UNKNOWN for an unsupported product id', async () => {
      await createDictationDevice(/* productId= */ 0x9999);
      expect(state.dictationDevice.getDeviceType()).toBe(DeviceType.UNKNOWN);
    });
  });

  it('handles input reports', async () => {
    await createDictationDevice(/* productId= */ 0x0004);

    const testCases: ButtonMappingTestCase[] = [
      {inputReportData: [0, 0x07], expectedButtonEvents: undefined},
      {inputReportData: [0, 0x06], expectedButtonEvents: ButtonEvent.PLAY},
      {inputReportData: [0, 0x05], expectedButtonEvents: ButtonEvent.FORWARD},
      {inputReportData: [0, 0x03], expectedButtonEvents: ButtonEvent.REWIND},
      {
        inputReportData: [0, 0x04],
        expectedButtonEvents: ButtonEvent.PLAY | ButtonEvent.FORWARD,
      },
      {
        inputReportData: [0, 0x02],
        expectedButtonEvents: ButtonEvent.PLAY | ButtonEvent.REWIND,
      },
      {
        inputReportData: [0, 0x01],
        expectedButtonEvents: ButtonEvent.FORWARD | ButtonEvent.REWIND,
      },
      {
        inputReportData: [0, 0x00],
        expectedButtonEvents:
            ButtonEvent.PLAY | ButtonEvent.FORWARD | ButtonEvent.REWIND,
      },
    ];
    const resetButtonInputReport = [0, 0x07];
    await checkButtonMapping(
        state.fakeHidDevice, state.dictationDevice, state.buttonEventListener,
        testCases, resetButtonInputReport);
  });

  it('folds the fourth bit onto the third one', async () => {
    await createDictationDevice(/* productId= */ 0x0004);

    const testCases: ButtonMappingTestCase[] = [
      {inputReportData: [0, 0x0b], expectedButtonEvents: ButtonEvent.REWIND},
      {inputReportData: [0, 0x0f], expectedButtonEvents: undefined},
    ];
    const resetButtonInputReport = [0, 0x07];
    await checkButtonMapping(
        state.fakeHidDevice, state.dictationDevice, state.buttonEventListener,
        testCases, resetButtonInputReport);
  });
});
