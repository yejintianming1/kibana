/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { cleanKibana, reload } from '../tasks/common';
import { loginAndWaitForPage } from '../tasks/login';
import { HOSTS_URL } from '../urls/navigation';
import { openEvents } from '../tasks/hosts/main';
import { DRAGGABLE_HEADER } from '../screens/timeline';
import { TABLE_COLUMN_EVENTS_MESSAGE } from '../screens/hosts/external_events';
import { waitsForEventsToBeLoaded } from '../tasks/hosts/events';
import { removeColumn } from '../tasks/timeline';

// Failing: See https://github.com/elastic/kibana/issues/75794
describe.skip('persistent timeline', () => {
  beforeEach(() => {
    cleanKibana();
    loginAndWaitForPage(HOSTS_URL);
    openEvents();
    waitsForEventsToBeLoaded();
  });

  it('persist the deletion of a column', () => {
    cy.get(DRAGGABLE_HEADER).then((header) => {
      const currentNumberOfTimelineColumns = header.length;
      const expectedNumberOfTimelineColumns = currentNumberOfTimelineColumns - 1;

      cy.wrap(header).eq(TABLE_COLUMN_EVENTS_MESSAGE).invoke('text').should('equal', 'message');
      removeColumn(TABLE_COLUMN_EVENTS_MESSAGE);

      cy.get(DRAGGABLE_HEADER).should('have.length', expectedNumberOfTimelineColumns);

      reload(waitsForEventsToBeLoaded);

      cy.get(DRAGGABLE_HEADER).should('have.length', expectedNumberOfTimelineColumns);
      cy.get(DRAGGABLE_HEADER).each(($el) => {
        expect($el.text()).not.equal('message');
      });
    });
  });
});
