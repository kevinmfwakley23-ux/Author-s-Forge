import {
  addBookToSeries,
  addSeriesTimelineEvent,
  removeBookFromSeries,
  removeSeriesTimelineEvent,
  reorderSeriesBooks,
  updateSeriesDetails,
  validateSeriesState,
  type SeriesDetailsUpdate,
  type SeriesState,
  type SeriesTimelineEvent,
} from "../domain/series";

export class SeriesService {
  constructor(private readonly projectId: string, private state: SeriesState) {
    if (state.projectId !== projectId) throw new Error("Series belongs to another project.");
    this.state = validateSeriesState(state);
  }

  getState(): SeriesState { return validateSeriesState(this.state); }

  update(details: SeriesDetailsUpdate): SeriesState {
    this.state = updateSeriesDetails(this.state, details);
    return this.getState();
  }

  addBook(bookId: string): SeriesState {
    this.state = addBookToSeries(this.state, bookId);
    return this.getState();
  }

  removeBook(bookId: string): SeriesState {
    this.state = removeBookFromSeries(this.state, bookId);
    return this.getState();
  }

  reorderBooks(bookIds: readonly string[]): SeriesState {
    this.state = reorderSeriesBooks(this.state, bookIds);
    return this.getState();
  }

  addTimelineEvent(event: SeriesTimelineEvent): SeriesState {
    this.state = addSeriesTimelineEvent(this.state, event);
    return this.getState();
  }

  removeTimelineEvent(eventId: string): SeriesState {
    this.state = removeSeriesTimelineEvent(this.state, eventId);
    return this.getState();
  }
}
