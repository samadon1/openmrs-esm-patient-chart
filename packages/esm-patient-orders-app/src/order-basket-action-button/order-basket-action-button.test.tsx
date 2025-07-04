import React from 'react';
import { screen, render, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ActionMenuButton,
  launchWorkspace,
  type OpenWorkspace,
  useFeatureFlag,
  useLayoutType,
  useWorkspaces,
  type WorkspacesInfo,
} from '@openmrs/esm-framework';
import { type OrderBasketItem, useOrderBasket } from '@openmrs/esm-patient-common-lib';
import { mockPatient } from 'tools';
import { orderBasketStore } from '@openmrs/esm-patient-common-lib/src/orders/store';
import OrderBasketActionButton from './order-basket-action-button.extension';

const MockActionMenuButton = jest.mocked(ActionMenuButton);
const mockLaunchWorkspace = jest.mocked(launchWorkspace);
const mockUseLayoutType = jest.mocked(useLayoutType);
const mockUseWorkspaces = jest.mocked(useWorkspaces);

MockActionMenuButton.mockImplementation(({ handler, label, tagContent }) => (
  <button onClick={handler}>
    {tagContent} {label}
  </button>
));

mockUseWorkspaces.mockReturnValue({
  workspaces: [{ type: 'order-basket' } as OpenWorkspace],
  workspaceWindowState: 'normal',
} as unknown as WorkspacesInfo);

// This pattern of mocking seems to be required: defining the mocked function here and
// then assigning it with an arrow function wrapper in jest.mock. It is very particular.
// I think it is related to this: https://github.com/swc-project/jest/issues/14#issuecomment-1238621942

const mockLaunchStartVisitPrompt = jest.fn();
const mockUseVisitOrOfflineVisit = jest.fn(() => ({
  activeVisit: {
    uuid: '8ef90c91-14be-42dd-a1c0-e67fbf904470',
  },
  currentVisit: {
    uuid: '8ef90c91-14be-42dd-a1c0-e67fbf904470',
  },
}));
const mockGetPatientUuidFromUrl = jest.fn(() => mockPatient.id);
const mockUseSystemVisitSetting = jest.fn();

jest.mock('@openmrs/esm-patient-common-lib/src/useSystemVisitSetting', () => {
  return {
    useSystemVisitSetting: () => mockUseSystemVisitSetting(),
  };
});

jest.mock('@openmrs/esm-patient-common-lib/src/launchStartVisitPrompt', () => {
  return { launchStartVisitPrompt: () => mockLaunchStartVisitPrompt() };
});

jest.mock('@openmrs/esm-patient-common-lib/src/store/patient-chart-store', () => {
  return {
    getPatientUuidFromStore: () => mockGetPatientUuidFromUrl(),
    usePatientChartStore: () => ({ patientUuid: mockPatient.id }),
  };
});

jest.mock('@openmrs/esm-patient-common-lib/src/offline/visit', () => {
  return { useVisitOrOfflineVisit: () => mockUseVisitOrOfflineVisit() };
});

mockUseSystemVisitSetting.mockReturnValue({ systemVisitEnabled: false });

const mockedUseFeatureFlag = jest.mocked(useFeatureFlag);

describe('<OrderBasketActionButton/>', () => {
  beforeAll(() => {
    orderBasketStore.setState({
      items: {
        [mockPatient.id]: {
          medications: [{ name: 'order-01', uuid: 'some-uuid' } as unknown as OrderBasketItem],
        },
      },
    });
  });

  it('should display tablet view action button', async () => {
    const user = userEvent.setup();
    mockUseLayoutType.mockReturnValue('tablet');
    render(<OrderBasketActionButton />);

    const orderBasketButton = screen.getByRole('button', { name: /Order Basket/i });
    expect(orderBasketButton).toBeInTheDocument();
    await user.click(orderBasketButton);
    expect(mockLaunchWorkspace).toHaveBeenCalledWith('order-basket', expect.any(Object));
  });

  it('should display desktop view action button', async () => {
    const user = userEvent.setup();
    mockUseLayoutType.mockReturnValue('small-desktop');
    render(<OrderBasketActionButton />);

    const orderBasketButton = screen.getByRole('button', { name: /order basket/i });
    expect(orderBasketButton).toBeInTheDocument();
    await user.click(orderBasketButton);
    expect(mockLaunchWorkspace).toHaveBeenCalledWith('order-basket', expect.any(Object));
  });

  it('should prompt user to start visit if no currentVisit found', async () => {
    mockedUseFeatureFlag.mockReturnValue(false);
    const user = userEvent.setup();
    mockUseLayoutType.mockReturnValue('small-desktop');
    mockUseSystemVisitSetting.mockReturnValue({ systemVisitEnabled: true });
    mockUseVisitOrOfflineVisit.mockImplementation(() => ({
      activeVisit: null,
      currentVisit: null,
    }));

    render(<OrderBasketActionButton />);

    const orderBasketButton = screen.getByRole('button', { name: /order basket/i });
    expect(orderBasketButton).toBeInTheDocument();
    await user.click(orderBasketButton);
    expect(mockLaunchWorkspace).not.toHaveBeenCalled();
    expect(mockLaunchStartVisitPrompt).toHaveBeenCalled();
  });

  it('should display a count tag when orders are present on the desktop view', () => {
    mockUseLayoutType.mockReturnValue('small-desktop');
    const { result } = renderHook(useOrderBasket);
    expect(result.current.orders).toHaveLength(1); // sanity check
    render(<OrderBasketActionButton />);

    expect(screen.getByText(/order basket/i)).toBeInTheDocument();
    expect(screen.getByText(/1/i)).toBeInTheDocument();
  });

  it('should display the count tag when orders are present on the tablet view', () => {
    mockUseLayoutType.mockReturnValue('tablet');
    render(<OrderBasketActionButton />);

    expect(screen.getByRole('button', { name: /1 order basket/i })).toBeInTheDocument();
  });
});
