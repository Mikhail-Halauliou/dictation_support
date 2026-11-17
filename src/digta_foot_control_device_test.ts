import {ButtonEvent, DeviceType, ImplementationType} from './dictation_device_base';
import {DigtaFootControlDevice} from './digta_foot_control_device';
import {ButtonMappingTestCase, checkButtonMapping} from './test_util/check_button_mapping';
import {cleanState} from './test_util/clean_state';
import {FakeHidDevice} from './test_util/fake_hid_device';

describe('DigtaFootControlDevice', () => {
  const state = cleanState<{
    buttonEventListener: jasmine.Spy,
    dictationDevice: DigtaFootControlDevice,
    fakeHidDevice: FakeHidDevice,
  }>();

  beforeEach(() => {
    state.buttonEventListener = jasmine.createSpy('buttonEventListener');
  });

  async function createDictationDevice(productId: number) {
    state.fakeHidDevice = new FakeHidDevice({productId, vendorId: 0x15d8});
    state.dictationDevice = DigtaFootControlDevice.create(state.fakeHidDevice);
    state.dictationDevice.addButtonEventListener(state.buttonEventListener);
    await state.dictationDevice.init();
  }

  describe('creates the right device type', () => {
    it('DIGTA_FOOT_CONTROL_540', async () => {
      await createDictationDevice(/* productId= */ 0x0024);
      expect(state.dictationDevice.getDeviceType())
          .toBe(DeviceType.DIGTA_FOOT_CONTROL_540);
      expect(state.dictationDevice.implType)
          .toBe(ImplementationType.DIGTA_FOOT_CONTROL);
    });

    it('DIGTA_FOOT_PEDAL_538', async () => {
      await createDictationDevice(/* productId= */ 0x0018);
      expect(state.dictationDevice.getDeviceType())
          .toBe(DeviceType.DIGTA_FOOT_PEDAL_538);
      expect(state.dictationDevice.implType)
          .toBe(ImplementationType.DIGTA_FOOT_CONTROL);
    });

    it('UNKNOWN for an unsupported product id', async () => {
      await createDictationDevice(/* productId= */ 0x9999);
      expect(state.dictationDevice.getDeviceType()).toBe(DeviceType.UNKNOWN);
    });
  });

  it('handles input reports with the button state in the second byte',
     async () => {
       await createDictationDevice(/* productId= */ 0x0024);

       const testCases: ButtonMappingTestCase[] = [
         {inputReportData: [0, 0], expectedButtonEvents: undefined},
         {inputReportData: [0, 1], expectedButtonEvents: ButtonEvent.FORWARD},
         {inputReportData: [0, 2], expectedButtonEvents: ButtonEvent.PLAY},
         {inputReportData: [0, 4], expectedButtonEvents: ButtonEvent.REWIND},
         {
           inputReportData: [0, 3],
           expectedButtonEvents: ButtonEvent.FORWARD | ButtonEvent.PLAY,
         },
         {
           inputReportData: [0, 7],
           expectedButtonEvents:
               ButtonEvent.FORWARD | ButtonEvent.PLAY | ButtonEvent.REWIND,
         },
         {inputReportData: [0, 8], expectedButtonEvents: undefined},
       ];
       const resetButtonInputReport = [0, 0];
       await checkButtonMapping(
           state.fakeHidDevice, state.dictationDevice,
           state.buttonEventListener, testCases, resetButtonInputReport);
     });

  it('handles input reports with the button state in the first byte',
     async () => {
       await createDictationDevice(/* productId= */ 0x0024);

       const testCases: ButtonMappingTestCase[] = [
         {inputReportData: [0, 0], expectedButtonEvents: undefined},
         {inputReportData: [1, 0], expectedButtonEvents: ButtonEvent.FORWARD},
         {inputReportData: [2, 0], expectedButtonEvents: ButtonEvent.PLAY},
         {inputReportData: [4, 0], expectedButtonEvents: ButtonEvent.REWIND},
       ];
       const resetButtonInputReport = [0, 0];
       await checkButtonMapping(
           state.fakeHidDevice, state.dictationDevice,
           state.buttonEventListener, testCases, resetButtonInputReport);
     });

  it('handles input reports with the button state in the report id',
     async () => {
       await createDictationDevice(/* productId= */ 0x0024);

       await state.fakeHidDevice.handleInputReport([0, 0], /* reportId= */ 2);
       expect(state.buttonEventListener)
           .toHaveBeenCalledOnceWith(state.dictationDevice, ButtonEvent.PLAY);

       state.buttonEventListener.calls.reset();
       await state.fakeHidDevice.handleInputReport([0, 0], /* reportId= */ 0);
       expect(state.buttonEventListener)
           .toHaveBeenCalledOnceWith(state.dictationDevice, ButtonEvent.NONE);
     });
});
