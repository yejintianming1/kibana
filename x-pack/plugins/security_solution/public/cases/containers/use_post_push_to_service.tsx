/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { useReducer, useCallback } from 'react';

import {
  ServiceConnectorCaseResponse,
  ServiceConnectorCaseParams,
  CaseConnector,
  CommentType,
} from '../../../../case/common/api';
import {
  errorToToaster,
  useStateToaster,
  displaySuccessToast,
} from '../../common/components/toasters';

import { getCase, pushToService, pushCase } from './api';
import * as i18n from './translations';
import { Case } from './types';
import { CaseServices } from './use_get_case_user_actions';

interface PushToServiceState {
  serviceData: ServiceConnectorCaseResponse | null;
  pushedCaseData: Case | null;
  isLoading: boolean;
  isError: boolean;
}
type Action =
  | { type: 'FETCH_INIT' }
  | { type: 'FETCH_SUCCESS_PUSH_SERVICE'; payload: ServiceConnectorCaseResponse | null }
  | { type: 'FETCH_SUCCESS_PUSH_CASE'; payload: Case | null }
  | { type: 'FETCH_FAILURE' };

const dataFetchReducer = (state: PushToServiceState, action: Action): PushToServiceState => {
  switch (action.type) {
    case 'FETCH_INIT':
      return {
        ...state,
        isLoading: true,
        isError: false,
      };
    case 'FETCH_SUCCESS_PUSH_SERVICE':
      return {
        ...state,
        isLoading: false,
        isError: false,
        serviceData: action.payload ?? null,
      };
    case 'FETCH_SUCCESS_PUSH_CASE':
      return {
        ...state,
        isLoading: false,
        isError: false,
        pushedCaseData: action.payload ?? null,
      };
    case 'FETCH_FAILURE':
      return {
        ...state,
        isLoading: false,
        isError: true,
      };
    default:
      return state;
  }
};

interface PushToServiceRequest {
  caseId: string;
  connector: CaseConnector;
  caseServices: CaseServices;
  updateCase: (newCase: Case) => void;
}

export interface UsePostPushToService extends PushToServiceState {
  postPushToService: ({
    caseId,
    caseServices,
    connector,
    updateCase,
  }: PushToServiceRequest) => void;
}

export const usePostPushToService = (): UsePostPushToService => {
  const [state, dispatch] = useReducer(dataFetchReducer, {
    serviceData: null,
    pushedCaseData: null,
    isLoading: false,
    isError: false,
  });
  const [, dispatchToaster] = useStateToaster();

  const postPushToService = useCallback(
    async ({ caseId, caseServices, connector, updateCase }: PushToServiceRequest) => {
      let cancel = false;
      const abortCtrl = new AbortController();
      try {
        dispatch({ type: 'FETCH_INIT' });
        const casePushData = await getCase(caseId, true, abortCtrl.signal);
        const responseService = await pushToService(
          connector.id,
          connector.type,
          formatServiceRequestData(casePushData, connector, caseServices),
          abortCtrl.signal
        );
        const responseCase = await pushCase(
          caseId,
          {
            connector_id: connector.id,
            connector_name: connector.name,
            external_id: responseService.id,
            external_title: responseService.title,
            external_url: responseService.url,
          },
          abortCtrl.signal
        );
        if (!cancel) {
          dispatch({ type: 'FETCH_SUCCESS_PUSH_SERVICE', payload: responseService });
          dispatch({ type: 'FETCH_SUCCESS_PUSH_CASE', payload: responseCase });
          updateCase(responseCase);
          displaySuccessToast(
            i18n.SUCCESS_SEND_TO_EXTERNAL_SERVICE(connector.name),
            dispatchToaster
          );
        }
      } catch (error) {
        if (!cancel) {
          errorToToaster({
            title: i18n.ERROR_TITLE,
            error: error.body && error.body.message ? new Error(error.body.message) : error,
            dispatchToaster,
          });
          dispatch({ type: 'FETCH_FAILURE' });
        }
      }
      return () => {
        cancel = true;
        abortCtrl.abort();
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return { ...state, postPushToService };
};

export const formatServiceRequestData = (
  myCase: Case,
  connector: CaseConnector,
  caseServices: CaseServices
): ServiceConnectorCaseParams => {
  const {
    id: caseId,
    createdAt,
    createdBy,
    comments,
    description,
    title,
    updatedAt,
    updatedBy,
  } = myCase;
  const actualExternalService = caseServices[connector.id] ?? null;

  return {
    savedObjectId: caseId,
    createdAt,
    createdBy: {
      fullName: createdBy.fullName ?? null,
      username: createdBy?.username ?? '',
    },
    comments: comments
      .filter(
        (c) =>
          actualExternalService == null || actualExternalService.commentsToUpdate.includes(c.id)
      )
      .map((c) => ({
        commentId: c.id,
        comment: c.type === CommentType.user ? c.comment : '',
        createdAt: c.createdAt,
        createdBy: {
          fullName: c.createdBy.fullName ?? null,
          username: c.createdBy.username ?? '',
        },
        updatedAt: c.updatedAt,
        updatedBy:
          c.updatedBy != null
            ? {
                fullName: c.updatedBy.fullName ?? null,
                username: c.updatedBy.username ?? '',
              }
            : null,
      })),
    description,
    externalId: actualExternalService?.externalId ?? null,
    title,
    ...(connector.fields ?? {}),
    updatedAt,
    updatedBy:
      updatedBy != null
        ? {
            fullName: updatedBy.fullName ?? null,
            username: updatedBy.username ?? '',
          }
        : null,
  };
};
